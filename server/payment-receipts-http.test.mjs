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
import { validateReceipt } from "./payment-receipts.mjs";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII=",
  "base64",
);
test("payment screenshot rejects non-images, empty files and oversized images", () => {
  for (const value of [
    Buffer.alloc(0),
    Buffer.from("<html>"),
    Buffer.from("%PDF-1.4"),
    Buffer.alloc(5 * 1024 * 1024 + 1),
  ])
    assert.throws(() => validateReceipt(value));
  assert.equal(validateReceipt(png), "image/png");
  assert.equal(
    validateReceipt(Buffer.from([255, 216, 255, 224])),
    "image/jpeg",
  );
});

test("live PayMe HTTP accepts screenshot only, protects receipt access and requires independent verification", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "nurse-payme-http-"));
  const dbPath = join(dir, "test.sqlite");
  const base = "http://localhost:3212";
  const env = {
    ...process.env,
    PORT: "3212",
    API_PORT: "",
    BASE_URL: base,
    WORKFLOW_DB: dbPath,
    WORKSPACE_MODE: "live",
    AUTH_MODE: "google",
    GOOGLE_CLIENT_ID: "fixture-client",
    GOOGLE_CLIENT_SECRET: "fixture-secret",
    STAFF_ADMIN_EMAILS: "admin@example.test",
    STAFF_SENIOR_NURSE_EMAILS: "senior@example.test",
    PAYMENT_MODE: "payme",
    PAYME_LINK: "https://payme.hsbc/fixture",
    PAYME_ACCOUNT_NAME: "Fixture Company",
    SMTP_HOST: "",
    STRIPE_SECRET_KEY: "",
    BANK_NAME: "",
    BANK_ACCOUNT_NAME: "",
    BANK_ACCOUNT_NUMBER: "",
  };
  const w = new Workflow(dbPath, {
    baseUrl: base,
    paymentMode: "payme",
    paymeLink: env.PAYME_LINK,
    paymeAccountName: env.PAYME_ACCOUNT_NAME,
  });
  Object.assign(w.state.settings, {
    nurse_day_rate: 245,
    nurse_night_rate: 270,
  });
  const c = w.create({
    surname: "Receipt test",
    email: "family@example.test",
    district: "屯門",
    building: "Test building",
    date: "2026-11-10",
    shift: "DAY",
    start: "10:00",
    end: "14:00",
    fictional: true,
    services: [{ id: "vitals", times: ["12:00"] }],
  });
  c.intake_mode = "LIVE";
  const accept = w.state.tokens.find(
    (x) => x.case_id === c.id && x.action === "accept_single",
  ).token;
  w.act(accept);
  const paymentEmail = w.state.emails.find((m) => m.template_id === "T8");
  assert.ok(
    paymentEmail.links.some(
      (l) => l.label === "PayMe" && l.url === env.PAYME_LINK,
    ),
  );
  assert.match(paymentEmail.body, /毋須填寫參考編號/);
  const reportUrl = paymentEmail.links.find(
    (l) => l.label === "report_fps",
  ).url;
  new StaffAuth(w.db, { env, baseUrl: base });
  for (const role of ["admin", "senior"]) {
    const token = `${role}-session`,
      email = `${role}@example.test`;
    w.db
      .prepare("INSERT INTO staff_sessions VALUES (?,?,?,?,?,?)")
      .run(
        createHash("sha256").update(token).digest("hex"),
        staffId(email),
        email,
        `csrf-${role}`,
        Date.now(),
        Date.now() + 3600000,
      );
  }
  w.save();
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
  });
  const auth = (role = "admin") => ({
    Cookie: `kindred_session=${role}-session`,
  });
  const snapshot = async (role) =>
    (await fetch(base + "/api/workflow", { headers: auth(role) })).json();
  const upload = async (file, headers = {}, duplicate = false) => {
    const form = new FormData();
    form.append(
      "screenshot",
      new Blob([file], { type: "image/png" }),
      "payment.png",
    );
    if (duplicate) form.append("screenshot", new Blob([png]), "extra.png");
    return fetch(reportUrl, { method: "POST", headers, body: form });
  };
  const formPage = await fetch(reportUrl);
  assert.equal(formPage.status, 200);
  assert.doesNotMatch(await formPage.text(), /name="reference"/);
  assert.equal((await snapshot()).payment_submissions.length, 0);
  assert.equal(
    (await upload(png, { Origin: "https://attacker.invalid" })).status,
    403,
  );
  assert.equal((await upload(png, { Origin: "null" })).status, 403);
  assert.equal(
    (
      await fetch(reportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: "REF", amount: 1220 }),
      })
    ).status,
    400,
  );
  assert.equal((await upload(Buffer.from("fake PNG"))).status, 400);
  assert.equal(
    (await upload(Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]))).status,
    400,
  );
  assert.equal((await upload(png, {}, true)).status, 400);
  assert.equal((await snapshot()).payment_submissions.length, 0);
  const posted = await upload(png, {
    Origin: "null",
    "Sec-Fetch-Site": "same-origin",
  });
  assert.equal(posted.status, 200, await posted.clone().text());
  assert.match(await posted.text(), /等候同事核實/);
  const state = await snapshot();
  assert.equal(state.cases[0].status, "PENDING_PAY");
  const submission = state.payment_submissions[0];
  assert.ok(submission.screenshot.id);
  assert.equal(submission.reference, undefined);
  assert.equal(submission.amount, undefined);
  assert.equal(submission.transferred_at, undefined);
  assert.equal((await upload(png)).status, 400);
  const route = base + "/api/payment-receipt/" + submission.screenshot.id;
  assert.equal((await fetch(route)).status, 401);
  assert.equal((await fetch(route, { headers: auth("senior") })).status, 403);
  assert.equal((await snapshot("senior")).payment_submissions, undefined);
  const downloaded = await fetch(route, { headers: auth() });
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("cache-control"), "no-store");
  assert.equal(downloaded.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
  assert.equal(
    (await fetch(base + "/api/payment-receipt/missing", { headers: auth() }))
      .status,
    404,
  );
  const reconcile = (extra = {}) =>
    fetch(base + "/api/case-action", {
      method: "POST",
      headers: {
        ...auth(),
        Origin: base,
        "X-CSRF-Token": "csrf-admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: c.id,
        action: "reconcile_fps",
        submission_id: submission.id,
        bank_reference: "PAYME-RECEIVED-001",
        amount: 1220,
        received_at: new Date().toISOString(),
        verified: true,
        reason: "Checked actual PayMe receipt",
        ...extra,
      }),
    });
  assert.equal((await reconcile({ verified: false })).status, 400);
  assert.equal((await reconcile({ amount: 1 })).status, 400);
  assert.equal((await reconcile()).status, 200);
  assert.equal((await snapshot()).cases[0].status, "PAID");
});
