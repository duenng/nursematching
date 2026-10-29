import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Workflow } from "./workflow.mjs";
import { StaffAuth, staffId } from "./auth.mjs";

test("HTTP Google sessions enforce roles, CSRF, clinical privacy and individual approval audit", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "nurse-auth-http-"));
  const dbPath = join(dir, "test.sqlite");
  const port = 3201;
  const base = `http://localhost:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    API_PORT: "",
    BASE_URL: base,
    WORKFLOW_DB: dbPath,
    AUTH_MODE: "google",
    GOOGLE_CLIENT_ID: "fixture-client",
    GOOGLE_CLIENT_SECRET: "fixture-secret",
    STAFF_ADMIN_EMAILS: "admin@example.test",
    STAFF_SENIOR_NURSE_EMAILS: "senior@example.test",
    WORKFLOW_ADMIN_KEY: "no-bypass",
    PAYMENT_MODE: "mock",
    SMTP_HOST: "",
    STRIPE_SECRET_KEY: "",
  };
  // Session fixtures live only in this test DB. No login bypass endpoint exists in the server.
  const w = new Workflow(dbPath, { baseUrl: base });
  new StaffAuth(w.db, { env, baseUrl: base });
  for (const [token, email] of [
    ["admin-session", "admin@example.test"],
    ["senior-session", "senior@example.test"],
  ]) {
    w.db
      .prepare("INSERT INTO staff_sessions VALUES (?,?,?,?,?,?)")
      .run(
        createHash("sha256").update(token).digest("hex"),
        staffId(email),
        email,
        "csrf-" + token,
        Date.now(),
        Date.now() + 3600000,
      );
  }
  w.db.close();
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const done = once(child, "exit");
      child.kill("SIGTERM");
      await done;
    }
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Server startup timed out")),
      10000,
    );
    child.stdout.on("data", (data) => {
      if (data.toString().includes("listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}`));
    });
    child.stderr.on("data", (data) => {
      if (data.toString().includes("Error")) {
        clearTimeout(timer);
        reject(new Error(data.toString()));
      }
    });
  });
  async function request(
    path,
    body,
    role = "admin",
    expected = 200,
    extra = {},
  ) {
    const token = `${role}-session`;
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: `kindred_session=${token}`,
        Origin: base,
        "Content-Type": "application/json",
        "X-CSRF-Token": "csrf-" + token,
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "manual",
    });
    const data = await r.json();
    assert.equal(r.status, expected, JSON.stringify(data));
    return data;
  }
  assert.equal(
    (
      await fetch(base + "/api/workflow", {
        headers: { Authorization: "Bearer no-bypass" },
      })
    ).status,
    401,
  );
  const session = await request("/auth/session");
  assert.equal(session.user.role, "ADMIN");
  const redirect = await fetch(base + "/auth/google", { redirect: "manual" });
  assert.equal(redirect.status, 302);
  const login = new URL(redirect.headers.get("location"));
  assert.equal(login.origin, "https://accounts.google.com");
  assert.equal(
    login.searchParams.get("redirect_uri"),
    base + "/auth/google/callback",
  );
  assert.equal(login.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    (await fetch(base + "/auth/google/callback?state=wrong&code=nope")).status,
    400,
  );
  await request("/api/settings", {}, "senior", 403);
  await request("/api/evidence", {}, "admin", 403, {
    "X-CSRF-Token": "invalid",
  });
  await request("/api/evidence", {}, "admin", 403, {
    Origin: "https://attacker.invalid",
  });
  let state = await request("/api/workflow");
  await request("/api/settings", {
    time_scale: 1,
    nurse_day_rate: 245,
    nurse_night_rate: 270,
    nurses: state.nurses,
  });
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const c = await request("/api/cases", {
    surname: "陳",
    email: "family@example.test",
    district: "屯門",
    building: "虛構大廈",
    date: future,
    shift: "DAY",
    start: "10:00",
    end: "14:00",
    fictional: true,
    services: [{ id: "vitals", times: ["12:00"] }],
  });
  state = await request("/api/workflow");
  const accept = state.emails.find(
    (m) => m.case_id === c.id && m.template_id === "T1",
  ).links[0].url;
  assert.equal((await fetch(accept, { method: "POST" })).status, 200);
  await request("/api/case-action", { id: c.id, action: "mock_paid" });
  await request("/api/case-action", { id: c.id, action: "dispatch" });
  state = await request("/api/workflow");
  const take = state.emails.find(
    (m) => m.case_id === c.id && m.template_id === "T3",
  ).links[0].url;
  await fetch(take, { method: "POST" });
  state = await request("/api/workflow");
  const unit = state.emails.find(
    (m) => m.case_id === c.id && m.template_id === "T16",
  ).links[0].url;
  await fetch(unit, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unit: "秘密測試單位" }),
  });
  await request("/api/case-action", { id: c.id, action: "draft" }, "senior");
  await request(
    "/api/case-action",
    { id: c.id, action: "nurse" },
    "admin",
    403,
  );
  await request(
    "/api/case-action",
    { id: c.id, action: "admin" },
    "senior",
    403,
  );
  await request(
    "/api/case-action",
    { id: c.id, action: "reconcile_fps" },
    "senior",
    403,
  );
  const reviewed = await request(
    "/api/case-action",
    { id: c.id, action: "nurse" },
    "senior",
  );
  assert.equal(reviewed.reviewed_by, staffId("senior@example.test"));
  assert.equal(reviewed.email, undefined);
  assert.equal(reviewed.unit, undefined);
  const clinical = await request("/api/workflow", undefined, "senior");
  for (const field of [
    "emails",
    "tokens",
    "payment_submissions",
    "payment_reconciliations",
    "packages",
    "events",
  ])
    assert.equal(clinical[field], undefined);
  assert.ok(!JSON.stringify(clinical).includes("秘密測試單位"));
  await request("/api/case-action", { id: c.id, action: "admin" });
  state = await request("/api/workflow");
  assert.equal(state.cases[0].status, "READY");
  assert.equal(state.cases[0].confirmed_by, staffId("admin@example.test"));
  assert.equal(
    state.events.find((e) => e.event === "schedule.nurse_reviewed").actor_code,
    staffId("senior@example.test"),
  );
  assert.equal(
    state.events.find((e) => e.event === "schedule.confirmed").actor_code,
    staffId("admin@example.test"),
  );
  assert.equal(
    state.events.find((e) => e.event === "lock.won").actor_code,
    "N01",
  );
  assert.ok(
    state.events.some(
      (e) => e.event === "email.captured" && e.actor === "system",
    ),
  );
  // Actual multipart path and private document download, without any Google network call.
  const clinicalCase = await request("/api/cases", {
    surname: "李",
    email: "family@example.test",
    district: "屯門",
    building: "虛構大廈",
    date: future,
    shift: "DAY",
    start: "15:00",
    end: "19:00",
    intake_mode: "LIVE",
    consent: true,
    doctor_order: "YES",
    existing_tube: "YES",
    services: [{ id: "ng-change", times: ["16:00"] }],
  });
  state = await request("/api/workflow");
  await fetch(
    state.emails.find(
      (m) => m.case_id === clinicalCase.id && m.template_id === "T1",
    ).links[0].url,
    { method: "POST" },
  );
  await request("/api/case-action", {
    id: clinicalCase.id,
    action: "mock_paid",
  });
  state = await request("/api/workflow");
  const upload = state.emails
    .find((m) => m.case_id === clinicalCase.id && m.template_id === "T9")
    .links.find((l) => l.label === "upload_doctor").url;
  const uploadPage = await (await fetch(upload)).text();
  assert.match(uploadPage, /multipart\/form-data/);
  assert.match(uploadPage, /name="consent"/);
  assert.doesNotMatch(uploadPage, /虛構/);
  const form = new FormData();
  form.set("fictional", "yes");
  form.set(
    "sample",
    new Blob(["%PDF-1.4\nFictional doctor-order sample"], {
      type: "application/pdf",
    }),
    "fixture.pdf",
  );
  const rejected = await fetch(upload, {
    method: "POST",
    headers: { Origin: base },
    body: form,
  });
  assert.equal(rejected.status, 400);
  form.delete("fictional");
  form.set("consent", "yes");
  const uploaded = await fetch(upload, {
    method: "POST",
    headers: { Origin: base },
    body: form,
  });
  assert.equal(uploaded.status, 200, await uploaded.text());
  assert.equal(
    (
      await fetch(upload, {
        method: "POST",
        headers: { Origin: base },
        body: form,
      })
    ).status,
    400,
  );
  const worklist = await request("/api/workflow", undefined, "senior");
  const document = worklist.cases.find(
    (c) => c.id === clinicalCase.id,
  ).doctor_document;
  const path = base + "/api/doctor-document/" + document.id;
  assert.equal((await fetch(path)).status, 401);
  const download = await fetch(path, {
    headers: { Cookie: "kindred_session=senior-session" },
  });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/pdf");
  assert.match(download.headers.get("content-disposition"), /attachment/);
  assert.match(await download.text(), /Fictional doctor-order/);
  const publicResponse = await fetch(base + "/api/enquiries", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      intake_version: "legacy-test",
      surname: "李",
      email: "family@example.test",
      patient_ref: "PUBLIC-HTTP",
      gender: "M",
      age: 78,
      weight_kg: 65,
      height_cm: 165,
      mobility: "需人輔助",
      companion: "YES",
      district: "屯門",
      building: "未知虛構大廈",
      date: future,
      shift: "DAY",
      start: "10:00",
      end: "14:00",
      consent: true,
      remote_confirmed: true,
      amount_paid: 1220,
      status: "PAID",
      services: [{ id: "vitals", times: ["12:00"] }],
    }),
  });
  assert.equal(publicResponse.status, 200);
  const publicCase = await publicResponse.json();
  assert.deepEqual(Object.keys(publicCase).sort(), ["id", "status"]);
  assert.equal(publicCase.status, "MANUAL");
  await request("/auth/logout", {}, "admin");
  await request("/api/workflow", undefined, "admin", 401);
});
