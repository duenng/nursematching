import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workflow } from "./workflow.mjs";
import { dispatchBody, confirmationDetails } from "./workflow-content.mjs";
const H = 3600000;
const base = (extra) => ({
  surname: "陳",
  email: "family@example.test",
  district: "屯門",
  building: "康樂大廈（虛構）",
  date: "2026-11-10",
  shift: "DAY",
  start: "10:00",
  end: "14:00",
  fictional: true,
  patient_ref: "PATIENT-1",
  services: [{ id: "vitals", times: ["12:00"] }],
  ...extra,
});
function setup(t) {
  let now = Date.parse("2026-10-29T12:00:00+08:00");
  const dir = mkdtempSync(join(tmpdir(), "nurse-full-"));
  const path = join(dir, "test.sqlite");
  const w = new Workflow(path, { now: () => now });
  Object.assign(w.state.settings, {
    nurse_day_rate: 245,
    nurse_night_rate: 270,
    package_offer_rule: "WEEKDAY_DAY_LE30",
    allow_arrival_completion: true,
    package_release: true,
  });
  t.after(() => {
    w.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    w,
    path,
    set: (x) => (now = typeof x === "string" ? Date.parse(x) : x),
    advance: (ms) => (now += ms),
  };
}
function token(w, c, a, n) {
  return w.state.tokens
    .filter(
      (t) =>
        t.case_id === c.id &&
        t.action === a &&
        (!n || t.actor === n) &&
        !t.used_at &&
        !t.void_at,
    )
    .at(-1)?.token;
}
function paid(w, c, kind = "accept_single") {
  w.act(token(w, c, kind));
  if (c.status === "PENDING_PAY") w.paid(c);
}
function ready(w, c, n = "N01") {
  w.dispatch(c);
  w.act(token(w, c, "take_case", n));
  w.act(token(w, c, "provide_unit"), { unit: "28 樓 Z 室" });
  w.review(c, "draft");
  w.review(c, "nurse");
  w.review(c, "admin");
  assert.equal(c.status, "READY");
}
function finish(w, c, set) {
  set(`${c.date}T${c.start}:00+08:00`);
  w.act(token(w, c, "arrived"));
  set(w.endAt(c));
  w.act(token(w, c, "visit_done"));
  assert.equal(c.status, "DONE");
}

test("C11/F15 new package purchase, exact-once deduction, low balance, exhaustion and payouts", (t) => {
  const { w, set } = setup(t);
  const c = w.create(base({ start: "09:00", end: "15:00" }));
  assert.ok(token(w, c, "accept_package"));
  paid(w, c, "accept_package");
  assert.equal(c.amount_paid, 8650);
  const p = w.state.packages[0];
  assert.equal(p.hours_reserved, 6);
  assert.equal(p.status, "PKG_ACTIVE");
  ready(w, c);
  const done = token(w, c, "visit_done");
  assert.throws(() => w.act(done), /失效/);
  finish(w, c, set);
  assert.equal(p.hours_used, 6);
  assert.equal(p.hours_reserved, 0);
  assert.equal(w.state.emails.filter((m) => m.template_id === "T28").length, 1);
  assert.throws(() => w.act(done));
  assert.equal(
    w.state.ledger_entries.filter((l) => l.type === "DEDUCT").length,
    1,
  );
  // Two further explicit services of 15h and 5h bring remaining balance to 4h.
  for (const [date, start, end] of [
    ["2026-11-16", "07:00", "22:00"],
    ["2026-11-20", "09:00", "14:00"],
  ]) {
    const d = w.create(base({ date, start, end }));
    assert.ok(token(w, d, "accept_existing_package"));
    paid(w, d, "accept_existing_package");
    assert.equal(d.status, "PAID");
    ready(w, d);
    finish(w, d, set);
  }
  assert.equal(p.hours_used, 26);
  assert.equal(w.state.emails.filter((m) => m.template_id === "T29").length, 1);
  const last = w.create(base({ date: "2026-11-24" }));
  paid(w, last, "accept_existing_package");
  ready(w, last);
  finish(w, last, set);
  assert.equal(p.hours_used, 30);
  assert.equal(p.status, "PKG_USED_UP");
  assert.equal(w.state.emails.filter((m) => m.template_id === "T30").length, 1);
  assert.equal(w.state.payouts.length, 4);
  assert.ok(w.state.payouts.every((p) => p.no_transfer));
});
test("package reservations prevent overspending and wrong patient reuse; timeout releases", (t) => {
  const { w, advance } = setup(t);
  const c = w.create(base({ start: "07:00", end: "22:00" }));
  paid(w, c, "accept_package");
  const d = w.create(
    base({ date: "2026-11-12", start: "07:00", end: "22:00" }),
  );
  paid(w, d, "accept_existing_package");
  assert.equal(w.state.packages[0].hours_reserved, 30);
  const e = w.create(base({ date: "2026-11-17" }));
  w.act(token(w, e, "accept_existing_package"));
  assert.equal(e.status, "MANUAL");
  assert.equal(w.state.packages[0].hours_reserved, 30);
  const other = w.create(base({ patient_ref: "ANOTHER" }));
  assert.ok(token(w, other, "accept_package"));
  assert.ok(!token(w, other, "accept_existing_package"));
  w.act(token(w, other, "accept_package"));
  advance(24 * H);
  w.tick();
  assert.equal(other.status, "PAY_TIMEOUT");
  assert.equal(w.state.packages[1].status, "PKG_PAY_TIMEOUT");
  assert.equal(w.state.packages[1].hours_reserved, 0);
});
test("F12 nurse drops, all old links invalid, rematch reuses confirmed schedule/address", (t) => {
  const { w } = setup(t);
  const c = w.create(base());
  paid(w, c);
  ready(w, c);
  const oldArrive = token(w, c, "arrived");
  const oldClaim = token(w, c, "take_case", "N02");
  w.act(token(w, c, "drop"), { reason: "測試不能出席" });
  assert.equal(c.status, "REMATCH");
  assert.equal(c.assigned_nurse, null);
  assert.equal(w.state.nurses[0].drop_count, 1);
  assert.throws(() => w.act(oldArrive));
  assert.throws(() => w.act(oldClaim));
  assert.ok(
    w.state.emails
      .filter((m) => m.template_id === "T21")
      .every(
        (m) => m.to !== "n01@example.test" && !m.body.includes("28 樓 Z 室"),
      ),
  );
  w.act(token(w, c, "take_case", "N02"));
  assert.equal(c.status, "READY");
  assert.equal(c.assigned_nurse, "N02");
  assert.equal(w.state.emails.filter((m) => m.template_id === "T11").length, 2);
  assert.ok(
    w.state.timers.find((t) => t.type === "REMATCH_EXPIRE").cancelled_at,
  );
});
test("F12/F13 rematch expiry and >=24h cancellation require refund approval; <24h manual", (t) => {
  const { w, advance, set } = setup(t);
  const c = w.create(base());
  paid(w, c);
  ready(w, c);
  w.act(token(w, c, "drop"), { reason: "測試" });
  advance(24 * H);
  w.tick();
  assert.equal(c.status, "FULL_REFUND");
  assert.equal(c.refund_status, "PENDING");
  assert.equal(c.refund_amount, 1220);
  w.approveRefund(c);
  assert.equal(c.status, "CANCELLED");
  assert.equal(c.refund_provider, "mock");
  assert.throws(() => w.approveRefund(c));
  const d = w.create(base({ date: "2026-11-12" }));
  paid(w, d);
  ready(w, d, "N02");
  set("2026-11-11T10:00:00+08:00");
  w.act(token(w, d, "cancel"));
  assert.equal(d.status, "FULL_REFUND");
  assert.equal(d.notice_hours, 24);
  w.approveRefund(d);
  assert.equal(d.status, "CANCELLED");
  const e = w.create(base({ date: "2026-11-18" }));
  paid(w, e);
  ready(w, e, "N03");
  set("2026-11-17T11:00:00+08:00");
  w.act(token(w, e, "cancel"));
  assert.equal(e.status, "MANUAL");
  assert.match(e.manual_reason, /少於 24/);
});
test("package cancellation releases reserved hours exactly once without refunding entire package", (t) => {
  const { w } = setup(t);
  const c = w.create(base());
  paid(w, c, "accept_package");
  ready(w, c);
  w.act(token(w, c, "cancel"));
  assert.equal(c.refund_amount, 0);
  w.approveRefund(c);
  const p = w.state.packages[0];
  assert.equal(c.refund_provider, "package_release");
  assert.equal(p.hours_reserved, 0);
  assert.equal(p.hours_used, 0);
  assert.equal(p.status, "PKG_ACTIVE");
  assert.equal(
    w.state.ledger_entries.filter((l) => l.type === "RELEASE").length,
    1,
  );
});
test("quote reminder/expiry, repost once to customer, repeated admin alert and unit chase", (t) => {
  const { w, advance } = setup(t);
  Object.assign(w.state.settings, {
    quote_expiry: true,
    repost: true,
    repeat_no_taker: true,
    unit_chase: true,
  });
  const c = w.create(base());
  advance(24 * H);
  w.tick();
  assert.equal(w.state.emails.filter((m) => m.template_id === "T2").length, 1);
  advance(24 * H);
  w.tick();
  assert.equal(c.status, "EXPIRED");
  assert.ok(!token(w, c, "accept_single"));
  const d = w.create(base());
  paid(w, d);
  w.dispatch(d);
  advance(24 * H);
  w.tick();
  assert.equal(d.repost_count, 1);
  assert.equal(w.state.emails.filter((m) => m.template_id === "T7").length, 1);
  advance(24 * H);
  w.tick();
  assert.equal(w.state.emails.filter((m) => m.template_id === "T7").length, 1);
  assert.equal(
    w.state.emails.filter((m) => m.template_id === "T14b").length,
    2,
  );
  w.act(token(w, d, "take_case", "N01"));
  advance(12 * H);
  w.tick();
  assert.equal(
    w.state.emails.filter((m) => m.case_id === d.id && m.template_id === "T16")
      .length,
    2,
  );
});
test("full intake validates all fields, all services, remote review and human schedule edits", (t) => {
  const { w } = setup(t);
  const full = base({
    intake_version: "v3",
    gender: "M",
    age: 78,
    weight_kg: 65,
    height_cm: 165,
    mobility: "需人輔助",
    companion: "YES",
  });
  assert.throws(() => w.create({ ...full, age: 121 }));
  const c = w.create(full);
  assert.equal(c.status, "MANUAL");
  assert.match(c.manual_reason, /偏遠/);
  assert.throws(() => w.adminCase(c, "issue_quote", { reason: "測試" }));
  w.adminCase(c, "remote", { tier: "C", reason: "核對虛構測試地址" });
  w.adminCase(c, "issue_quote", { reason: "資料核實" });
  paid(w, c);
  w.review(c, "draft");
  assert.throws(() =>
    w.adminCase(c, "schedule_edit", {
      schedule: [{ time: "12:00", item: "新增藥物" }],
      reason: "無效",
    }),
  );
  w.adminCase(c, "schedule_edit", {
    schedule: [{ time: "13:00", item: c.services[0].label }],
    reason: "家屬更正時間",
  });
  assert.equal(c.schedule_status, "PENDING_REVIEW");
  assert.equal(c.schedule_edits.length, 1);
  assert.equal(w.state.service_catalog.length, 19);
  const peg = w.create(
    base({
      services: [{ id: "peg-change", times: [] }],
      doctor_order: "YES",
      existing_tube: "YES",
    }),
  );
  assert.equal(peg.status, "MANUAL");
  assert.match(peg.manual_reason, /胃造口/);
  const remote = w.create(base({ building: "長洲大新樓（虛構）" }));
  assert.equal(remote.remote_tier, "A");
  assert.equal(remote.nurse_travel_allowance, 150);
  assert.equal(remote.quote.total, 1220);
});

test("holiday night pricing requires explicit reviewed amounts and preserves them through family acceptance", (t) => {
  const { w, path } = setup(t);
  const c = w.create(
    base({
      date: "2026-11-07",
      shift: "NIGHT12",
      start: "22:00",
      end: "10:00",
      services: [{ id: "vitals", times: ["23:00"] }],
    }),
  );
  assert.equal(c.status, "MANUAL");
  assert.match(c.manual_reason, /夜更涉及/);
  const reason = "已核實本次跨星期日夜更收費及附加費";
  const manual = { base: 3900, surcharge: 600, confirmed: true };
  assert.throws(() => w.adminCase(c, "issue_quote", { reason }), /夜更涉及/);
  for (const invalid of [
    null,
    {},
    { ...manual, confirmed: false },
    { ...manual, base: "3900" },
    { ...manual, base: -1 },
    { ...manual, base: 3900.5 },
    { ...manual, surcharge: null },
    { ...manual, surcharge: -1 },
    { ...manual, base: 0, surcharge: 0 },
    { ...manual, base: Number.MAX_SAFE_INTEGER, surcharge: 1 },
  ]) {
    assert.throws(
      () =>
        w.adminCase(c, "issue_quote", { reason, manual_night_quote: invalid }),
      /整數基本費/,
    );
    assert.equal(c.status, "MANUAL");
    assert.equal(c.quote, undefined);
  }
  assert.throws(
    () => w.adminCase(c, "issue_quote", { manual_night_quote: manual }),
    /10 字/,
  );
  assert.throws(
    () =>
      w.adminCase(c, "issue_quote", {
        reason: "已核實",
        manual_night_quote: manual,
      }),
    /10 字/,
  );
  w.asOperator({ id: "STAFF-QUOTE", role: "ADMIN", method: "google" }, () =>
    w.adminCase(c, "issue_quote", { reason, manual_night_quote: manual }),
  );
  assert.equal(c.status, "QUOTED");
  assert.equal(c.quote.total, 4500);
  assert.equal(c.quote.hours, 12);
  assert.equal(c.quote.reviewed_by, "STAFF-QUOTE");
  assert.equal(c.quote.review_reason, reason);
  assert.equal(c.quote.pricing_method, "MANUAL_NIGHT_HOLIDAY");
  const mail = w.state.emails.find(
    (m) => m.case_id === c.id && m.template_id === "T1",
  );
  assert.match(mail.body, /基本費 HK\$3900/);
  assert.match(mail.body, /附加費 HK\$600/);
  assert.match(mail.body, /總額：HK\$4500/);
  assert.match(mail.body, /翌日 10:00/);
  assert.match(mail.body, /經人工覆核/);
  assert.ok(!mail.body.includes(reason));
  assert.equal(
    w.state.events.find((e) => e.event === "quote.manually_reviewed")
      .actor_code,
    "STAFF-QUOTE",
  );
  w.act(token(w, c, "accept_single"));
  assert.equal(c.status, "PENDING_PAY");
  assert.equal(c.payment_amount, 4500);
  assert.equal(c.quote.total, 4500);
  assert.throws(() =>
    w.adminCase(c, "issue_quote", { reason, manual_night_quote: manual }),
  );
  const reopened = new Workflow(path, { seedNurses: false });
  assert.deepEqual(
    reopened.state.cases.find((item) => item.id === c.id).quote,
    c.quote,
  );
  reopened.db.close();
});

test("manual night amounts cannot override normal pricing or bypass remote and clinical checks", (t) => {
  const { w } = setup(t);
  const payload = {
    reason: "已核實本次夜更逐單收費依據",
    manual_night_quote: { base: 3250, surcharge: 0, confirmed: true },
  };
  const normal = w.create(base({ other: "需核實" }));
  assert.throws(() => w.adminCase(normal, "issue_quote", payload), /只適用/);
  const remote = w.create(
    base({
      intake_version: "v3",
      gender: "M",
      age: 78,
      weight_kg: 65,
      height_cm: 165,
      mobility: "需人輔助",
      companion: "YES",
      date: "2026-11-07",
      shift: "NIGHT10",
      services: [{ id: "vitals", times: ["23:00"] }],
    }),
  );
  assert.throws(() => w.adminCase(remote, "issue_quote", payload), /覆核偏遠/);
  w.adminCase(remote, "remote", { reason: "地址已核實", tier: "C" });
  w.adminCase(remote, "issue_quote", payload);
  assert.equal(remote.quote.total, 3250);
  assert.equal(remote.quote.surcharge, 0);
  assert.equal(remote.quote.hours, 10);
  const risk = w.create(
    base({
      date: "2026-11-07",
      shift: "NIGHT10",
      remarks: "胸痛",
      services: [{ id: "vitals", times: [] }],
    }),
  );
  assert.throws(() => w.adminCase(risk, "issue_quote", payload), /臨床處置/);
});
test("third drop suspends nurse; administrator must separately blacklist", (t) => {
  const { w } = setup(t);
  for (const date of ["2026-11-10", "2026-11-12", "2026-11-16"]) {
    const c = w.create(base({ date }));
    paid(w, c);
    ready(w, c);
    w.act(token(w, c, "drop"), { reason: "測試放飛" });
  }
  assert.equal(w.state.nurses[0].drop_count, 3);
  assert.equal(w.state.nurses[0].status, "SUSPENDED");
  assert.ok(w.state.emails.some((m) => m.template_id === "T14f"));
  const c = w.create(base({ date: "2026-11-20" }));
  paid(w, c);
  w.dispatch(c);
  assert.ok(!token(w, c, "take_case", "N01"));
});
test("transaction failures preserve state and no partial emails/ledger mutations", (t) => {
  const { w } = setup(t);
  const c = w.create(base());
  const before = w.state.emails.length;
  assert.throws(() => w.dispatch(c));
  assert.equal(c.status, "QUOTED");
  assert.equal(w.state.emails.length, before);
  paid(w, c, "accept_package");
  const p = w.state.packages[0];
  assert.throws(() => w.act("nonexistent"));
  assert.equal(p.hours_reserved, 4);
  assert.equal(w.state.cases[0], c);
});

test("F11 in-service reminders escalate once and confirmation stops escalation", (t) => {
  const { w, set, advance } = setup(t);
  w.state.settings.reminder_escalation = true;
  const c = w.create(
    base({
      services: [
        { id: "vitals", times: ["12:00", "13:00"] },
        { id: "suction", prn: true, times: [] },
      ],
    }),
  );
  paid(w, c);
  ready(w, c);
  set(`${c.date}T10:00:00+08:00`);
  w.act(token(w, c, "arrived"));
  assert.equal(c.status, "IN_SERVICE");
  assert.equal(c.reminders.length, 2);
  set(`${c.date}T11:50:00+08:00`);
  w.tick();
  assert.equal(w.state.emails.filter((m) => m.template_id === "T12").length, 1);
  advance(H);
  w.tick();
  assert.equal(w.state.emails.filter((m) => m.template_id === "T13").length, 1);
  const second = c.reminders[1];
  w.act(w.state.tokens.find((t) => t.ref === second.id).token);
  advance(H / 4);
  w.tick();
  w.tick();
  assert.ok(c.reminders[0].alerted_at);
  assert.ok(!second.alerted_at);
  assert.equal(
    w.state.emails.filter((m) => m.subject.includes("提醒仍未確認")).length,
    1,
  );
  assert.equal(
    w.state.events.find((e) => e.event === "reminder.confirmed").actor_code,
    "N01",
  );
});

test("remote review needs no reason and applies A/B allowance through dispatch and payout", (t) => {
  const { w, path, set } = setup(t);
  const c = w.create(base({ other: "需核實服務資料" }));
  assert.equal(c.status, "MANUAL");
  for (const tier of [undefined, "", "D", "UNMATCHED"]) {
    assert.throws(() => w.adminCase(c, "remote", { tier }), /有效地區分類/);
    assert.equal(c.nurse_travel_allowance, 0);
  }
  for (const [tier, amount] of [
    ["A", 150],
    ["C", 0],
    ["B", 150],
  ]) {
    w.asOperator({ id: "STAFF-REMOTE", role: "ADMIN", method: "google" }, () =>
      w.adminCase(c, "remote", { tier }),
    );
    assert.equal(c.remote_tier, tier);
    assert.equal(c.nurse_travel_allowance, amount);
    assert.equal(c.remote_reviewed_by, "STAFF-REMOTE");
    assert.ok(c.remote_reviewed_at);
    const audit = w.state.events
      .filter((e) => e.event === "remote.reviewed")
      .at(-1);
    assert.equal(audit.actor_code, "STAFF-REMOTE");
    assert.equal(audit.tier, tier);
    assert.equal(audit.nurse_travel_allowance, amount);
  }
  w.adminCase(c, "issue_quote");
  assert.equal(c.quote.total, 1220);
  const reopened = new Workflow(path, { seedNurses: false });
  const saved = reopened.state.cases.find((item) => item.id === c.id);
  assert.equal(saved.remote_tier, "B");
  assert.equal(saved.nurse_travel_allowance, 150);
  reopened.db.close();
  paid(w, c);
  ready(w, c);
  assert.equal(c.nurse_pay_total, 1130);
  for (const body of [
    dispatchBody(c, w.state.settings),
    confirmationDetails(c, "take_case", w.state.settings, w.now()),
    w.state.emails.find((m) => m.case_id === c.id && m.template_id === "T3")
      .body,
  ]) {
    assert.match(body, /交通津貼 HK\$150/);
    assert.match(body, /合共 HK\$1130/);
  }
  assert.throws(() => w.adminCase(c, "remote", { tier: "C" }), /派單前/);
  assert.equal(c.nurse_travel_allowance, 150);
  finish(w, c, set);
  const payout = w.state.payouts.find((p) => p.case_id === c.id);
  assert.equal(payout.base_pay, 980);
  assert.equal(payout.travel_allowance, 150);
  assert.equal(payout.total, 1130);
});

test("remote B requires explicit admin allowance review and uses T14g", (t) => {
  const { w } = setup(t);
  w.state.remote_list = [
    { place: "康樂大廈", tier: "B", list_version: "test-v1" },
  ];
  const c = w.create(base());
  assert.equal(c.status, "MANUAL");
  assert.ok(
    w.state.emails.some((m) => m.case_id === c.id && m.template_id === "T14g"),
  );
  w.adminCase(c, "issue_quote", { reason: "計價資料已核對" });
  paid(w, c);
  assert.throws(() => w.dispatch(c), /交通津貼/);
  w.adminCase(c, "remote", { tier: "C", reason: "人手核對後取消津貼" });
  w.dispatch(c);
  assert.equal(c.nurse_pay_total, 980);
  assert.equal(c.quote.total, 1220);
});

test("nurse claim links expire at service start even before the worker runs", (t) => {
  const { w, set } = setup(t);
  const c = w.create(base({ date: "2026-11-10" }));
  paid(w, c);
  w.dispatch(c);
  const claim = token(w, c, "take_case", "N01");
  // A token persisted before the expiry fix must also be rejected at current service start.
  w.state.tokens.find((t) => t.token === claim).expires_at =
    "2026-12-01T00:00:00Z";
  set("2026-11-10T09:59:59+08:00");
  assert.doesNotThrow(() => w.inspect(claim));
  set("2026-11-10T10:00:00+08:00");
  assert.throws(() => w.act(claim), /失效/);
  assert.equal(c.status, "POSTED");
});

test("red-flag manual cases require a recorded clinical resolution before quoting", (t) => {
  const { w } = setup(t);
  const c = w.create(base({ remarks: "胸痛，呼吸困難" }));
  assert.equal(c.status, "MANUAL");
  assert.equal(c.red_flag, true);
  delete c.red_flag; // Older persisted cases did not store this marker.
  assert.throws(
    () => w.adminCase(c, "issue_quote", { reason: "資料核實" }),
    /紅旗個案/,
  );
  assert.throws(
    () =>
      w.adminCase(c, "issue_quote", {
        reason: "臨床覆核",
        red_flag_resolution: "已完成臨床評估，確認可以按原定服務重新報價。",
      }),
    /紅旗個案/,
  );
  w.adminCase(c, "issue_quote", {
    reason: "臨床覆核",
    red_flag_resolved: true,
    red_flag_resolution: "已完成臨床評估，確認可以按原定服務重新報價。",
  });
  assert.equal(c.status, "QUOTED");
  assert.equal(c.red_flag_resolved_by, "admin");
  assert.ok(
    w.state.events.some((e) => e.event === "clinical.red_flag_resolved"),
  );
});

test("paid manual cases can request refund without bypassing approval; reserved package cannot be closed unpaid", (t) => {
  const { w } = setup(t);
  const c = w.create(base());
  paid(w, c, "accept_package");
  ready(w, c);
  w.adminCase(c, "doctor_failed");
  assert.equal(c.status, "MANUAL");
  assert.throws(() => w.adminCase(c, "manual_cancel", { reason: "測試" }));
  w.adminCase(c, "manual_refund", { reason: "人手確認取消並釋放預留" });
  assert.equal(c.status, "FULL_REFUND");
  assert.equal(w.state.packages[0].hours_reserved, 4);
  assert.ok(
    w.state.emails.some((m) => m.case_id === c.id && m.template_id === "T24"),
  );
  w.approveRefund(c);
  assert.equal(c.status, "CANCELLED");
  assert.equal(w.state.packages[0].hours_reserved, 0);
  assert.equal(c.refund_provider, "package_release");
});
