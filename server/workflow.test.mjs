import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workflow, price, defaults, HOLIDAYS } from "./workflow.mjs";
const input = (extra = {}) => ({
  surname: "陳",
  email: "family@example.test",
  district: "屯門",
  building: "康樂大廈（虛構）",
  date: "2026-11-10",
  shift: "DAY",
  start: "10:00",
  end: "14:00",
  fictional: true,
  services: [
    { id: "vitals", label: "檢測生命表徵", times: ["12:00"], prn: false },
  ],
  ...extra,
});
function setup(t) {
  let now = Date.parse("2026-10-29T12:00:00+08:00");
  const dir = mkdtempSync(join(tmpdir(), "nurse-trl3-"));
  const w = new Workflow(join(dir, "workflow.sqlite"), { now: () => now });
  t.after(() => {
    w.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    w,
    advance: (ms) => {
      now += ms;
    },
    set: (ms) => {
      now = ms;
    },
  };
}
const token = (w, c, action, actor) =>
  w.state.tokens.find(
    (t) =>
      t.case_id === c.id &&
      t.action === action &&
      (!actor || t.actor === actor),
  ).token;
function matched(w, c) {
  w.act(token(w, c, "accept_single"));
  w.paid(c);
  w.state.settings.nurse_day_rate = 245;
  w.state.settings.nurse_night_rate = 270;
  w.dispatch(c);
  w.act(token(w, c, "take_case", "N01"));
}
test("C01–C12 applicable prices and both official holiday years", () => {
  assert.equal(HOLIDAYS.length, 34);
  assert.equal(new Set(HOLIDAYS).size, 34);
  for (const [extra, total] of [
    [{}, 1220],
    [{ start: "09:00", end: "11:00" }, 1220],
    [{ start: "09:00", end: "15:00" }, 1830],
    [{ start: "07:00", end: "22:00" }, 4575],
    [
      { date: "2026-11-17", shift: "NIGHT10", start: "22:00", end: "08:00" },
      3250,
    ],
    [
      { date: "2026-11-18", shift: "NIGHT12", start: "22:00", end: "10:00" },
      3900,
    ],
    [{ date: "2026-11-22", end: "16:00" }, 2010],
    [{ date: "2026-12-25", start: "09:00", end: "13:00" }, 1340],
    [{ date: "2026-12-26", start: "09:00", end: "13:00" }, 1340],
    [{ date: "2026-11-24", start: "09:00", end: "15:00" }, 1830],
    [{ date: "2027-03-26", start: "09:00", end: "13:00" }, 1340],
    [{ date: "2026-02-19" }, 1340],
    [{ date: "2026-06-19" }, 1340],
  ])
    assert.equal(price(input(extra)).total, total);
  assert.ok(price(input({ date: "2026-12-24", shift: "NIGHT12" })).manual);
  assert.ok(
    price(input({ date: "2026-12-25", start: "09:00", end: "11:00" })).manual,
  );
  assert.ok(price(input({ end: "14:30" })).manual);
});
test("F01–F03 GET only logs, acceptance invalidates siblings, reuse rejected", (t) => {
  const { w } = setup(t);
  const c = w.create(input());
  const accept = token(w, c, "accept_single");
  for (let i = 0; i < 3; i++) w.inspect(accept);
  assert.equal(c.status, "QUOTED");
  assert.equal(
    w.state.events.filter((e) => e.event === "link.opened").length,
    3,
  );
  w.act(accept);
  assert.equal(c.status, "PENDING_PAY");
  assert.equal(w.state.emails.at(-1).template_id, "T8");
  assert.ok(w.state.tokens.find((t) => t.action === "modify").void_at);
  assert.throws(() => w.act(accept), /失效/);
  assert.throws(() => w.act(token(w, c, "decline")), /失效/);
});
test("F04/F06/F07 paid gate and exactly one nurse wins; unverified refused", (t) => {
  const { w } = setup(t);
  const c = w.create(input());
  assert.throws(() => w.dispatch(c), /先接受/);
  w.act(token(w, c, "accept_single"));
  w.paid(c);
  assert.equal(c.status, "PAID");
  assert.ok(w.state.timers.every((t) => t.cancelled_at));
  assert.throws(() => w.dispatch(c), /薪酬/);
  w.state.settings.nurse_day_rate = 245;
  w.state.settings.nurse_night_rate = 270;
  w.dispatch(c);
  assert.equal(w.state.emails.filter((e) => e.template_id === "T3").length, 4);
  assert.ok(!w.state.tokens.some((t) => t.actor === "N05"));
  const forced = w.token(c, "N05", "take_case").url.split("t=")[1];
  w.act(forced);
  assert.equal(c.status, "POSTED");
  for (let i = 1; i <= 4; i++) w.act(token(w, c, "take_case", `N0${i}`));
  assert.equal(c.assigned_nurse, "N01");
  assert.equal(w.state.events.filter((e) => e.event === "lock.won").length, 1);
  assert.equal(w.state.events.filter((e) => e.event === "lock.lost").length, 4);
});
test("F05/F08 timers fire once; real clock and accelerated deadlines", (t) => {
  const { w, advance } = setup(t);
  const c = w.create(input());
  w.act(token(w, c, "accept_single"));
  advance(12 * 3600000);
  w.tick();
  assert.equal(w.state.emails.filter((e) => e.template_id === "T10").length, 1);
  advance(12 * 3600000);
  w.tick();
  w.tick();
  assert.equal(c.status, "PAY_TIMEOUT");
  assert.equal(
    w.state.emails.filter((e) => e.template_id === "T10b").length,
    1,
  );
  assert.throws(() => w.paid(c));
  assert.throws(() => w.act(token(w, c, "cancel")));
  w.state.settings.time_scale = 60;
  const d = w.create(input());
  w.act(token(w, d, "accept_single"));
  assert.equal(Date.parse(d.payment_deadline) - w.now(), 24 * 60000);
  w.paid(d);
  w.state.settings.nurse_day_rate = 245;
  w.state.settings.nurse_night_rate = 270;
  w.dispatch(d);
  advance(24 * 60000);
  w.tick();
  w.tick();
  assert.equal(
    w.state.emails.filter((e) => e.case_id === d.id && e.template_id === "T7")
      .length,
    1,
  );
  assert.equal(d.status, "POSTED");
});
test("F09/F10 private unit and schedule three gates before T11", (t) => {
  const { w } = setup(t);
  const c = w.create(input());
  matched(w, c);
  assert.throws(() => w.review(c, "admin"), /資深/);
  w.review(c, "draft");
  w.review(c, "nurse");
  w.review(c, "admin");
  assert.equal(c.status, "MATCHED");
  assert.ok(!w.state.emails.some((e) => e.template_id === "T11"));
  w.act(token(w, c, "provide_unit"), { unit: "12 樓 B 室" });
  assert.equal(c.status, "READY");
  const detail = w.state.emails.find((e) => e.template_id === "T11");
  assert.equal(detail.to, "n01@example.test");
  assert.match(detail.body, /12 樓 B 室/);
  assert.ok(
    w.state.emails
      .filter((e) => e.template_id === "T3")
      .every((e) => !e.body.includes("12 樓 B 室")),
  );
  assert.throws(() => w.review(c, "draft"));
  assert.equal(w.state.emails.filter((e) => e.template_id === "T11").length, 1);
});
test("F11 reminder/chase/confirmation is explicit; PRN creates no timer", (t) => {
  const { w, set, advance } = setup(t);
  const c = w.create(
    input({
      services: [
        { id: "vitals", label: "檢測生命表徵", times: ["12:00"] },
        { id: "suction", label: "抽痰／拍痰", prn: true, times: [] },
      ],
    }),
  );
  matched(w, c);
  w.review(c, "draft");
  w.review(c, "nurse");
  w.act(token(w, c, "provide_unit"), { unit: "測試單位" });
  w.review(c, "admin");
  assert.equal(c.reminders.length, 1);
  set(Date.parse("2026-11-10T11:50:00+08:00"));
  w.tick();
  w.tick();
  assert.equal(w.state.emails.filter((e) => e.template_id === "T12").length, 1);
  assert.ok(!c.reminders[0].confirmed_at);
  advance(3600000);
  w.tick();
  w.tick();
  assert.equal(w.state.emails.filter((e) => e.template_id === "T13").length, 1);
  w.act(token(w, c, "confirm_reminder"));
  assert.ok(c.reminders[0].confirmed_at);
});
test("F14/F16 cancel before payment stops timers; illegal transition logged", (t) => {
  const { w, advance } = setup(t);
  const c = w.create(input());
  w.act(token(w, c, "accept_single"));
  w.act(token(w, c, "cancel"));
  assert.equal(c.status, "CANCELLED");
  advance(48 * 3600000);
  w.tick();
  assert.ok(!w.state.emails.some((e) => e.template_id === "T10b"));
  assert.throws(() => w.transition({ status: "DONE", id: "fake" }, "POSTED"));
  assert.equal(w.state.events.at(-1).event, "transition.rejected");
});
test("C05/C06 invalid windows, clinical and unknown rules fail conservatively", (t) => {
  const { w } = setup(t);
  for (const extra of [
    { start: "20:00", end: "23:00" },
    { start: "06:00", end: "10:00" },
    { email: "bad" },
    { phone: "123" },
    { date: "2026-11-31" },
    { services: [] },
  ])
    assert.throws(() => w.create(input(extra)));
  assert.equal(w.state.cases.length, 0);
  for (const extra of [
    { remarks: "胸口痛同氣促" },
    { remarks: "血糖18，係咪要加胰島素？" },
    { remarks: "昏迷叫唔醒" },
    { remarks: "傷口流緊膿，係咪發炎？" },
    { other: "教工人沖涼" },
    { date: "2026-10-30" },
    {
      date: "2026-12-24",
      shift: "NIGHT12",
      services: [{ id: "vitals", label: "血壓", times: [], prn: true }],
    },
  ])
    assert.equal(w.create(input(extra)).status, "MANUAL");
  const b = {
    services: [{ id: "ng-change", label: "更換現有鼻胃喉", times: [] }],
    existing_tube: "YES",
    doctor_order: "YES",
  };
  assert.equal(w.create(input(b)).status, "QUOTED");
  assert.equal(
    w.create(input({ ...b, doctor_order: "NO" })).status,
    "NO_DR_ORDER",
  );
  assert.equal(
    w.create(input({ ...b, existing_tube: "NO_FIRST_INSERT" })).status,
    "NO_FIRST_INSERT",
  );
});
test("server records persist across reopen", (t) => {
  const { w } = setup(t);
  w.create(input());
  const path = w.db.prepare("PRAGMA database_list").get().file;
  w.save();
  const other = new Workflow(path, { now: w.now });
  assert.equal(other.state.cases.length, 1);
  assert.equal(
    other.state.emails.filter((m) => m.template_id === "T1").length,
    1,
  );
  other.db.close();
});
