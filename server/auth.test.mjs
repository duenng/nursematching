import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { StaffAuth, canAccess, clinicalWorkspace, staffId } from "./auth.mjs";

const origin = "https://test.example";
const env = {
  AUTH_MODE: "google",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  STAFF_ADMIN_EMAILS: "admin@example.test",
  STAFF_SENIOR_NURSE_EMAILS: "nurse@example.test",
  WORKFLOW_ADMIN_KEY: "must-not-bypass",
};
const req = (cookie = "", headers = {}) => ({
  headers: { cookie, ...headers },
  socket: { remoteAddress: "127.0.0.1" },
});
function setup(t, email = "admin@example.test") {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  let now = Date.parse("2026-10-29T12:00:00+08:00");
  let payload;
  const events = [];
  const provider = {
    generateCodeVerifierAsync: async () => ({
      codeVerifier: "secret-verifier",
      codeChallenge: "public-challenge",
    }),
    generateAuthUrl: (options) => {
      payload = {
        email,
        sub: "google-subject",
        email_verified: true,
        nonce: options.nonce,
        iss: "https://accounts.google.com",
        exp: now / 1000 + 3600,
      };
      return (
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams(options)
      );
    },
    getToken: async (args) => {
      assert.equal(args.codeVerifier, "secret-verifier");
      return { tokens: { id_token: "verified-by-test-provider" } };
    },
    verifyIdToken: async (args) => {
      assert.equal(args.audience, "test-client");
      return { getPayload: () => payload };
    },
  };
  const auth = new StaffAuth(db, {
    env: { ...env },
    baseUrl: origin,
    now: () => now,
    provider,
    audit: (...event) => events.push(event),
  });
  return {
    auth,
    db,
    provider,
    now: () => now,
    events,
    advance: (ms) => (now += ms),
    change: (patch) => Object.assign(payload, patch),
  };
}
async function start(auth) {
  const login = await auth.begin();
  const state = new URL(login.location).searchParams.get("state");
  return {
    login,
    request: req(login.cookie.split(";")[0]),
    callback: new URL(
      `${origin}/auth/google/callback?state=${state}&code=valid`,
    ),
  };
}
async function login(auth) {
  const startLogin = await start(auth);
  const result = await auth.finish(startLogin.request, startLogin.callback);
  const request = req(result.cookies[0].split(";")[0]);
  return { result, request, user: auth.current(request) };
}

test("Google code flow binds browser, PKCE, nonce; session is hashed, HttpOnly and wall-time limited", async (t) => {
  const { auth, db, advance, events } = setup(t);
  const { request, user, result } = await login(auth);
  assert.equal(result.location, "/#staff/email");
  assert.equal(user.role, "ADMIN");
  assert.equal(user.id, staffId("admin@example.test"));
  assert.match(
    result.cookies[0],
    /__Host-kindred_session=.*; Path=\/; HttpOnly; SameSite=Lax; Max-Age=28800; Secure/,
  );
  assert.ok(
    !db
      .prepare("SELECT token_hash FROM staff_sessions")
      .get()
      .token_hash.includes(request.headers.cookie.split("=")[1]),
  );
  assert.equal(events[0][0], "auth.login");
  assert.ok(!JSON.stringify(events).includes("admin@example.test"));
  advance(8 * 3600000);
  assert.equal(auth.current(request), null);
});
test("cross-site frontend keeps OAuth state cookie first-party compatible", async (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  const { provider, auth: providerAuth } = setup(t);
  const auth = new StaffAuth(db, {
    env: { ...env },
    baseUrl: "https://api.example.test",
    frontendUrl: "https://care.example.test",
    now: providerAuth.now,
    provider,
  });
  const login = await auth.begin();
  assert.match(login.cookie, /SameSite=Lax/);
  assert.match(login.cookie, /Secure/);
  const state = new URL(login.location).searchParams.get("state");
  const flowRequest = req(login.cookie.split(";")[0]);
  const result = await auth.finish(
    flowRequest,
    new URL(`https://api.example.test/auth/google/callback?state=${state}&code=valid&returnTo=https://attacker.invalid`),
  );
  assert.equal(result.location, "https://care.example.test/#staff/email");
  assert.match(result.cookies[0], /SameSite=None/);
});
test("OAuth wrong browser, wrong state, expiry and consumed callback fail closed", async (t) => {
  const { auth, advance } = setup(t);
  const flow = await start(auth);
  await assert.rejects(
    auth.finish(req("wrong=browser"), flow.callback),
    /browser state/,
  );
  await auth.finish(flow.request, flow.callback);
  await assert.rejects(
    auth.finish(flow.request, flow.callback),
    /browser state/,
  );
  const expired = await start(auth);
  advance(600001);
  await assert.rejects(
    auth.finish(expired.request, expired.callback),
    /expired/,
  );
});
test("unverified email, invalid nonce/issuer/expiry and accounts outside staff allowlist are denied", async (t) => {
  const { auth, change, db } = setup(t);
  for (const patch of [
    { email_verified: false },
    { nonce: "wrong" },
    { iss: "https://attacker.invalid" },
    { exp: 1 },
    { email: "outsider@example.test" },
  ]) {
    const flow = await start(auth);
    change(patch);
    await assert.rejects(auth.finish(flow.request, flow.callback));
  }
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM staff_sessions").get().count,
    0,
  );
});
test("Google token verification failure cannot create session", async (t) => {
  const { auth, provider, db } = setup(t);
  const flow = await start(auth);
  provider.verifyIdToken = async () => {
    throw new Error("Invalid signature");
  };
  await assert.rejects(auth.finish(flow.request, flow.callback), /signature/);
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM staff_sessions").get().count,
    0,
  );
});
test("CSRF required with exact origin; logout revokes session and allowlist changes remove access", async (t) => {
  const { auth } = setup(t);
  const { request, user } = await login(auth);
  assert.equal(auth.verifyMutation(request, user), false);
  assert.equal(
    auth.verifyMutation(
      req(request.headers.cookie, { origin: origin, "x-csrf-token": "wrong" }),
      user,
    ),
    false,
  );
  assert.equal(
    auth.verifyMutation(
      req(request.headers.cookie, {
        origin: "https://attacker.invalid",
        "x-csrf-token": user.csrf,
      }),
      user,
    ),
    false,
  );
  assert.equal(
    auth.verifyMutation(
      req(request.headers.cookie, { origin, "x-csrf-token": user.csrf }),
      user,
    ),
    true,
  );
  auth.logout(request);
  assert.equal(auth.current(request), null);
  const second = await login(auth);
  auth.admins.clear();
  assert.equal(auth.current(second.request), null);
});
test("Google mode refuses local/shared key bypass and prevents changed Google subject", async (t) => {
  const { auth, change } = setup(t);
  assert.equal(
    auth.current(
      req("", {
        host: "localhost:3000",
        authorization: "Bearer must-not-bypass",
      }),
    ),
    null,
  );
  await login(auth);
  const flow = await start(auth);
  change({ sub: "different-google-account" });
  await assert.rejects(
    auth.finish(flow.request, flow.callback),
    /identity changed/,
  );
});
test("roles enforce senior clinical actions and administrator final approval/payment boundary", () => {
  const admin = { role: "ADMIN", method: "google" },
    senior = { role: "SENIOR_NURSE", method: "google" };
  for (const action of ["nurse", "schedule_edit", "doctor_failed"]) {
    assert.equal(
      canAccess(admin, "/api/case-action", "POST", { action }),
      false,
    );
    assert.equal(
      canAccess(senior, "/api/case-action", "POST", { action }),
      true,
    );
  }
  for (const action of [
    "admin",
    "dispatch",
    "reconcile_fps",
    "refund",
    "record_fps_refund",
    "unknown_action",
  ]) {
    assert.equal(
      canAccess(senior, "/api/case-action", "POST", { action }),
      false,
    );
  }
  for (const path of [
    "/api/settings",
    "/api/remote-import",
    "/api/evidence",
    "/api/cases",
    "/api/nurse-action",
    "/api/test-clock",
  ])
    assert.equal(canAccess(senior, path, "POST", {}), false);
  assert.equal(canAccess(senior, "/api/workflow", "GET"), true);
  assert.equal(canAccess(null, "/api/workflow", "GET"), false);
});
test("clinical projection excludes family contact, tokens, bank records and unit", () => {
  const state = {
    cases: [
      {
        id: "C1",
        patient_ref: "TEST-1",
        medical_history: "虛構",
        services: [],
        email: "private",
        surname: "姓名",
        unit: "秘密單位",
        amount_paid: 1220,
        fps_refund_reference: "BANK",
        schedule: [],
      },
    ],
    tokens: ["secret"],
    emails: ["secret"],
    payment_submissions: ["secret"],
  };
  assert.deepEqual(clinicalWorkspace(state), {
    cases: [
      {
        id: "C1",
        patient_ref: "TEST-1",
        medical_history: "虛構",
        services: [],
        schedule: [],
      },
    ],
  });
});
test("misconfigured auth fails at startup, including overlapping roles and non-HTTPS remote URLs", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const overrides of [
      { GOOGLE_CLIENT_SECRET: "" },
      { STAFF_ADMIN_EMAILS: "" },
      { STAFF_SENIOR_NURSE_EMAILS: env.STAFF_ADMIN_EMAILS },
      { AUTH_MODE: "local" },
    ])
      assert.throws(
        () =>
          new StaffAuth(db, { env: { ...env, ...overrides }, baseUrl: origin }),
      );
    assert.throws(
      () => new StaffAuth(db, { env, baseUrl: "http://public.example" }),
      /HTTPS/,
    );
  } finally {
    db.close();
  }
});

test("Google library verifies signed OIDC audience/issuer/expiry and rejects tampered JWT", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "https://accounts.google.com",
    aud: "test-client",
    sub: "subject",
    iat: now - 10,
    exp: now + 3600,
  };
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "test" }),
  ).toString("base64url");
  const encode = (value) => {
    const data =
      header + "." + Buffer.from(JSON.stringify(value)).toString("base64url");
    return (
      data +
      "." +
      sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")
    );
  };
  const client = new OAuth2Client();
  const certs = { test: publicKey.export({ type: "spki", format: "pem" }) };
  const verify = (jwt, aud = "test-client") =>
    client.verifySignedJwtWithCertsAsync(jwt, certs, aud, [
      "https://accounts.google.com",
    ]);
  assert.equal((await verify(encode(payload))).getPayload().sub, "subject");
  await assert.rejects(verify(encode(payload), "wrong-audience"));
  await assert.rejects(
    verify(encode({ ...payload, iss: "https://attacker.invalid" })),
  );
  await assert.rejects(
    verify(encode({ ...payload, iat: now - 4000, exp: now - 1000 })),
  );
  const valid = encode(payload);
  const tampered = valid.split(".");
  tampered[1] = Buffer.from(
    JSON.stringify({ ...payload, sub: "attacker" }),
  ).toString("base64url");
  await assert.rejects(verify(tampered.join(".")));
});
