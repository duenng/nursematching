import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Workflow } from "./workflow.mjs";
import { saveNurse, staffSnapshot } from "./staff-workspace.mjs";

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "careknock-staff-"));
  const path = join(dir, "staff.sqlite");
  const w = new Workflow(path, {
    seedNurses: false,
    now: () => Date.parse("2026-10-30T12:00:00+08:00"),
  });
  w.live = true;
  t.after(() => {
    w.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { w, path };
}
const provider = {
  name: "Test nurse",
  email: "nurse@careknock.invalid",
  category: "RN",
  status: "VERIFIED",
  registration: "RN-TEST",
  verification_note: "Registration and current credentials reviewed",
  credentials_verified: true,
};
test("live admin alerts never default to a demo recipient and preserve undelivered notifications", (t) => {
  const { w } = fixture(t);
  const c = {
    id: "LIVE-ALERT",
    intake_mode: "LIVE",
    status: "SUBMITTED",
    email: "family@careknock.invalid",
    services: [],
  };
  w.state.cases.push(c);
  for (const configured of [
    undefined,
    "admin@example.test",
    "ADMIN@EXAMPLE.COM",
    "invalid",
  ]) {
    w.state.admin_email = configured;
    assert.equal(w.adminEmail(), "");
    assert.equal(staffSnapshot(w.state, true).admin_email, "");
    w.email(c, "T14m", w.adminEmail(), "Admin alert", "Needs review");
    assert.equal(w.state.emails.at(-1).status, "blocked");
    assert.equal(w.state.emails.at(-1).to, "");
    assert.match(w.state.emails.at(-1).error, /未寄出/);
    assert.equal(w.state.events.at(-1).event, "admin.alert");
  }
  w.state.admin_email = " Admin@careknock.invalid ";
  assert.equal(w.adminEmail(), "admin@careknock.invalid");
  w.email(c, "T14m", w.adminEmail(), "Admin alert", "Needs review");
  assert.equal(w.state.emails.at(-1).status, "queued");
  assert.equal(w.state.emails.at(-1).to, "admin@careknock.invalid");
});
test("live provider creation requires credential verification, rejects duplicate email and persists audit identity", (t) => {
  const { w, path } = fixture(t);
  assert.equal(w.state.nurses.length, 0);
  for (const input of [
    { ...provider, credentials_verified: false },
    { ...provider, registration: "" },
    { ...provider, verification_note: "" },
    { ...provider, email: "n01@example.test" },
  ])
    assert.throws(() => saveNurse(w, input));
  assert.equal(w.state.nurses.length, 0);
  const nurse = w.asOperator(
    { id: "STAFF-ADMIN", role: "ADMIN", method: "google" },
    () => saveNurse(w, provider),
  );
  assert.equal(nurse.verified_by, "STAFF-ADMIN");
  assert.equal(w.state.events.at(-1).actor_code, "STAFF-ADMIN");
  assert.throws(
    () => saveNurse(w, { ...provider, email: provider.email.toUpperCase() }),
    /已有/,
  );
  const reopened = new Workflow(path, { seedNurses: false });
  assert.equal(reopened.state.nurses[0].id, nurse.id);
  reopened.db.close();
  w.state.cases.push({
    id: "C-ACTIVE",
    status: "READY",
    assigned_nurse: nurse.id,
  });
  assert.throws(
    () => saveNurse(w, { ...provider, id: nurse.id, status: "SUSPENDED" }),
    /進行中/,
  );
  assert.equal(nurse.status, "VERIFIED");
});
test("live snapshots exclude test cases, linked finance and bearer tokens without deleting data", (t) => {
  const { w } = fixture(t);
  w.state.cases.push(
    { id: "TEST", intake_mode: "TEST", client_id: "TEST-C" },
    { id: "LIVE", intake_mode: "LIVE", client_id: "LIVE-C" },
  );
  w.state.clients.push({ id: "TEST-C" }, { id: "LIVE-C" });
  w.state.tokens.push({ token: "secret" });
  for (const key of [
    "emails",
    "timers",
    "events",
    "payouts",
    "payment_submissions",
    "payment_reconciliations",
    "ledger_entries",
  ])
    w.state[key].push({ case_id: "TEST" }, { case_id: "LIVE" });
  const snapshot = staffSnapshot(w.state, true);
  assert.equal("tokens" in snapshot, false);
  assert.deepEqual(
    snapshot.cases.map((c) => c.id),
    ["LIVE"],
  );
  assert.deepEqual(
    snapshot.clients.map((c) => c.id),
    ["LIVE-C"],
  );
  for (const key of [
    "emails",
    "timers",
    "events",
    "payouts",
    "payment_submissions",
    "payment_reconciliations",
    "ledger_entries",
  ])
    assert.deepEqual(
      snapshot[key].filter((x) => x.case_id).map((x) => x.case_id),
      ["LIVE"],
    );
  assert.equal(w.state.cases.length, 2);
});
test("live dispatch refuses empty or legacy unverified roster and past enquiries roll back", (t) => {
  const { w } = fixture(t);
  w.state.settings.nurse_day_rate = 245;
  w.state.settings.nurse_night_rate = 270;
  const c = { id: "C-PAID", status: "PAID", quote: { hours: 4 }, services: [] };
  w.state.cases.push(c);
  assert.throws(() => w.dispatch(c), /已核實/);
  w.state.nurses.push({ id: "OLD", status: "VERIFIED", email: provider.email });
  assert.throws(() => w.dispatch(c), /已核實/);
  assert.equal(c.status, "PAID");
  assert.throws(
    () =>
      w.create({
        surname: "李",
        email: "family@careknock.invalid",
        district: "屯門",
        building: "Building",
        date: "2026-10-29",
        shift: "DAY",
        start: "10:00",
        end: "14:00",
        intake_mode: "LIVE",
        consent: true,
        services: [{ id: "vitals", times: ["12:00"] }],
      }),
    /將來/,
  );
  assert.equal(w.state.cases.length, 1);
});
