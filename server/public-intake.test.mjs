import test from "node:test";
import assert from "node:assert/strict";
import { publicIntake, createIntakeLimiter } from "./public-intake.mjs";
import { Workflow } from "./workflow.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("public intake strips staff-only approval, quote, status and clock fields", () => {
  const input = publicIntake({
    surname: "陳",
    email: "family@example.test",
    services: [],
    intake_version: "legacy-test",
    fictional: true,
    intake_mode: "TEST",
    remote_confirmed: true,
    remote_tier: "C",
    remote_reviewed_by: "admin",
    status: "PAID",
    amount_paid: 1220,
    quote: { total: 1 },
  });
  assert.deepEqual(input, {
    surname: "陳",
    email: "family@example.test",
    services: [],
    intake_version: "v3",
    intake_mode: "LIVE",
  });
});
test("public intake rate limit bounds attempts and expires on wall time", () => {
  let now = Date.now();
  const allowed = createIntakeLimiter(() => now);
  for (let i = 0; i < 30; i++) assert.equal(allowed("test-IP"), true);
  assert.equal(allowed("test-IP"), false);
  assert.equal(allowed("another-IP"), true);
  now += 600001;
  assert.equal(allowed("test-IP"), true);
});

test("live public enquiries require explicit consent and persist its version without fictional mail", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "nurse-live-consent-"));
  const path = join(dir, "workflow.sqlite");
  const options = { now: () => Date.parse("2026-10-29T12:00:00+08:00") };
  let w = new Workflow(path, options);
  t.after(() => {
    w.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const input = {
    surname: "李",
    email: "family@example.test",
    patient_ref: "LIVE-FIXTURE",
    gender: "M",
    age: 78,
    weight_kg: 65,
    height_cm: 165,
    mobility: "需人輔助",
    companion: "YES",
    district: "屯門",
    building: "驗證大廈",
    date: "2026-11-10",
    shift: "DAY",
    start: "10:00",
    end: "14:00",
    services: [{ id: "vitals", times: ["12:00"] }],
    fictional: true,
    intake_mode: "TEST",
  };
  for (const consent of [undefined, false, "true"]) {
    assert.throws(
      () => w.create(publicIntake({ ...input, consent })),
      /同意保存/,
    );
    assert.equal(w.state.cases.length, 0);
    assert.equal(w.state.emails.length, 0);
  }
  assert.throws(
    () => w.create(publicIntake({ ...input, consent: true, email: "invalid" })),
    /電郵/,
  );
  const c = w.create(publicIntake({ ...input, consent: true }));
  assert.equal(c.intake_mode, "LIVE");
  assert.equal(c.fictional, false);
  assert.equal(c.consent, true);
  assert.equal(c.consent_version, "care-enquiry-v1");
  assert.equal(c.consent_at, new Date(options.now()).toISOString());
  assert.equal(c.status, "MANUAL");
  const familyMail = w.state.emails.filter(
    (m) => m.case_id === c.id && m.to === c.email,
  );
  assert.deepEqual(
    familyMail.map((m) => m.template_id),
    ["X01"],
  );
  assert.match(familyMail[0].body, /同事會透過電郵跟進/);
  assert.ok(
    w.state.emails.some(
      (m) => m.case_id === c.id && ["T14m", "T14g"].includes(m.template_id),
    ),
  );
  for (const mail of w.state.emails) {
    assert.doesNotMatch(mail.subject, /【測試】/);
    assert.doesNotMatch(mail.body, /所有資料均為虛構/);
  }
  w.event("email.receipt_confirmed", { id: c.id });
  assert.equal(w.state.events.at(-1).env, "LIVE");
  w.save();
  w.db.close();
  w = new Workflow(path, options);
  assert.equal(w.state.cases[0].consent_version, "care-enquiry-v1");
  assert.equal(w.state.cases[0].consent_at, c.consent_at);
});
