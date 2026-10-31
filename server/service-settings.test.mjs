import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Workflow } from "./workflow.mjs";
import { saveServiceSettings } from "./service-settings.mjs";
import { staffSnapshot } from "./staff-workspace.mjs";

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "careknock-settings-"));
  const path = join(dir, "workflow.sqlite");
  const w = new Workflow(path, {
    seedNurses: false,
    paymentMode: "bank_transfer",
  });
  w.live = true;
  w.state.cases.push({
    id: "LIVE-ACTIVE",
    intake_mode: "LIVE",
    status: "PAID",
    services: [],
  });
  t.after(() => {
    w.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { w, path };
}

test("active cases allow email-only saves and first nurse rates, persisted across reopen", (t) => {
  const { w, path } = fixture(t);
  assert.equal(staffSnapshot(w.state, true).settings_locked, true);
  saveServiceSettings(w, {
    admin_email: " Admin@careknock.invalid ",
    nurse_day_rate: "",
    nurse_night_rate: "",
  });
  assert.equal(w.adminEmail(), "admin@careknock.invalid");
  assert.equal(w.state.settings.nurse_day_rate, null);
  saveServiceSettings(w, { nurse_day_rate: "245", nurse_night_rate: "270" });
  // Posting the unchanged full form must also work while active.
  saveServiceSettings(w, {
    admin_email: "updated@careknock.invalid",
    time_scale: 1,
    nurse_day_rate: "245",
    nurse_night_rate: "270",
    policies: { quote_expiry: false, package_offer_rule: "MANUAL" },
  });
  const reopened = new Workflow(path, { seedNurses: false });
  assert.equal(reopened.state.admin_email, "updated@careknock.invalid");
  assert.equal(reopened.state.settings.nurse_day_rate, 245);
  assert.equal(reopened.state.settings.nurse_night_rate, 270);
  reopened.db.close();
});

test("active settings changes reject atomically, preserving rates, policies and email", (t) => {
  const { w } = fixture(t);
  saveServiceSettings(w, {
    admin_email: "admin@careknock.invalid",
    nurse_day_rate: 245,
    nurse_night_rate: 270,
  });
  for (const change of [
    { nurse_day_rate: 250 },
    { nurse_night_rate: 280 },
    { policies: { quote_expiry: true } },
    { policies: { package_offer_rule: "WEEKDAY_DAY_LE30" } },
    { time_scale: 60 },
    { nurse_day_rate: "" },
    { admin_email: "admin@example.test" },
  ]) {
    const before = structuredClone(w.state);
    assert.throws(() =>
      saveServiceSettings(w, {
        admin_email: "other@careknock.invalid",
        ...change,
      }),
    );
    assert.deepEqual(w.state, before);
  }
  w.state.cases[0].status = "DONE";
  assert.equal(staffSnapshot(w.state, true).settings_locked, false);
  saveServiceSettings(w, {
    nurse_day_rate: 250,
    policies: { quote_expiry: true },
  });
  assert.equal(w.state.settings.nurse_day_rate, 250);
  assert.equal(w.state.settings.quote_expiry, true);
});

test("invalid initial rates roll back email and the other rate", (t) => {
  const { w } = fixture(t);
  for (const rate of [0, -1, 1.5, "invalid", Number.MAX_SAFE_INTEGER + 1]) {
    const before = structuredClone(w.state);
    assert.throws(() =>
      saveServiceSettings(w, {
        admin_email: "admin@careknock.invalid",
        nurse_day_rate: 245,
        nurse_night_rate: rate,
      }),
    );
    assert.deepEqual(w.state, before);
  }
});
