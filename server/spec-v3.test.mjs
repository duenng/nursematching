import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workflow } from "./workflow.mjs";
import { staffSnapshot } from "./staff-workspace.mjs";
import { dispatchBody, confirmationDetails } from "./workflow-content.mjs";
import { TEMPLATE_VERSION } from "./templates.mjs";
const input = (extra = {}) => ({
  surname: "陳",
  email: "family@example.test",
  phone: "91234567",
  district: "屯門",
  building: "康樂大廈（虛構）",
  date: "2026-11-10",
  shift: "DAY",
  start: "10:00",
  end: "14:00",
  fictional: true,
  services: [{ id: "vitals", times: ["12:00"] }],
  ...extra,
});
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "nurse-v3-"));
  let now = Date.parse("2026-10-30T10:00:00+08:00");
  const w = new Workflow(join(dir, "test.sqlite"), { now: () => now });
  Object.assign(w.state.settings, {
    nurse_day_rate: 245,
    nurse_night_rate: 270,
  });
  t.after(() => {
    w.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const token = (c, action, actor) =>
    w.state.tokens.find(
      (x) =>
        x.case_id === c.id &&
        x.action === action &&
        (!actor || x.actor === actor) &&
        !x.used_at &&
        !x.void_at,
    );
  return {
    w,
    token,
    advance: (ms) => {
      now += ms;
    },
  };
}
test("v3 previews match initial, repeated and rematch dispatch and contain only permitted fields", (t) => {
  const { w, token } = fixture(t);
  const c = w.create(
    input({
      age: 80,
      medical_history: "糖尿病",
      remarks: "客人原文",
      weight_kg: 60,
      height_cm: 160,
    }),
  );
  w.act(token(c, "accept_single").token);
  w.paid(c);
  const adminPreview = w.state.emails.find((m) =>
    m.subject.includes("派單預覽"),
  );
  assert.ok(adminPreview);
  assert.equal(c.status, "PAID");
  const preview = staffSnapshot(w.state, false).cases[0].dispatch_preview_body;
  assert.match(preview, /HK\$245／小時，共 HK\$980/);
  for (const secret of [
    c.surname,
    c.phone,
    c.email,
    c.medical_history,
    c.remarks,
  ])
    assert.ok(!preview.includes(secret));
  w.dispatch(c);
  for (const mail of w.state.emails.filter((m) => m.template_id === "T3"))
    assert.ok(mail.body.startsWith(preview));
  c.unit = "12 樓 B 室";
  w.repost(c);
  w.act(token(c, "take_case", "N01").token);
  w.drop(c, "測試放飛");
  const rematch = w.state.emails.filter((m) => m.template_id === "T21");
  assert.equal(rematch.length, 3);
  assert.ok(
    rematch.every(
      (m) =>
        m.body.startsWith(dispatchBody(c, w.state.settings)) &&
        !m.body.includes(c.unit),
    ),
  );
});
test("v3 confirmation shows quote/package amounts, cancellation effects, and no family identity in nurse page", (t) => {
  const { w } = fixture(t);
  const c = w.create(input());
  assert.match(
    confirmationDetails(c, "accept_single", w.state.settings, w.now()),
    /基本費 HK\$1220.*附加費 HK\$0/,
  );
  assert.match(
    confirmationDetails(c, "accept_package", w.state.settings, w.now()),
    /30 小時套餐 HK\$8650/,
  );
  assert.match(
    confirmationDetails(c, "decline", w.state.settings, w.now()),
    /不收任何費用/,
  );
  c.status = "READY";
  assert.match(
    confirmationDetails(c, "cancel", w.state.settings, w.now()),
    /至少 24 小時/,
  );
  assert.match(
    confirmationDetails(
      c,
      "cancel",
      w.state.settings,
      Date.parse("2026-11-10T09:00:00+08:00"),
    ),
    /同事跟進/,
  );
});
test("v3 audit retains immutable history, safe token IDs, full fields and canonical events", (t) => {
  const { w, token, advance } = fixture(t);
  const c = w.create(input());
  const old = JSON.stringify(w.state.events);
  const accept = token(c, "accept_single");
  w.inspect(accept.token);
  const opened = accept.opened_at;
  advance(1000);
  w.inspect(accept.token);
  assert.equal(accept.opened_at, opened);
  assert.equal(
    JSON.stringify(w.state.events.slice(0, JSON.parse(old).length)),
    old,
  );
  w.act(accept.token);
  w.paid(c);
  w.dispatch(c);
  w.event("test.private", c, {
    reason: `${c.surname} ${c.phone} ${c.email} ${w.baseUrl}/a?t=${accept.token}`,
  });
  assert.ok(!JSON.stringify(w.state.events).includes(accept.token));
  for (const e of w.state.events) {
    for (const field of [
      "event_id",
      "ts",
      "env",
      "time_scale",
      "actor",
      "actor_code",
      "from_status",
      "to_status",
      "template_id",
      "template_version",
      "token_id",
      "detail_json",
    ])
      assert.ok(field in e, `${e.event}: ${field}`);
    assert.ok(!JSON.stringify(e).includes(c.email));
    assert.ok(!JSON.stringify(e).includes(c.phone));
  }
  assert.ok(w.state.events.some((e) => e.event === "quote.calculated"));
  assert.ok(
    w.state.events.some(
      (e) =>
        e.event === "status.changed" &&
        e.from_status === "QUOTED" &&
        e.to_status === "PENDING_PAY",
    ),
  );
  assert.ok(
    w.state.events.some(
      (e) => e.event === "timer.cancelled" && e.timer_code === "T-E",
    ),
  );
  assert.ok(
    w.state.events.some(
      (e) => e.event === "quote.accepted_single" && e.token_id === accept.id,
    ),
  );
  assert.ok(
    w.state.events
      .filter((e) => e.event === "email.queued")
      .every((e) => e.template_version === TEMPLATE_VERSION),
  );
});
test("v3 only winning nurse receives clinical details after all gates, original notes survive editing", (t) => {
  const { w, token } = fixture(t);
  const c = w.create(
    input({
      age: 80,
      gender: "M",
      height_cm: 160,
      weight_kg: 60,
      mobility: "需人輔助",
      recent_3m: ["疼痛"],
      medical_history: "糖尿病",
      companion: "YES",
      remarks: "請慢慢扶起",
    }),
  );
  w.act(token(c, "accept_single").token);
  w.paid(c);
  w.dispatch(c);
  w.act(token(c, "take_case", "N01").token);
  w.review(c, "draft");
  assert.equal(c.schedule[0].note, c.remarks);
  w.adminCase(c, "schedule_edit", {
    reason: "核對時間",
    schedule: [
      { item: c.services[0].label, time: "12:30", note: "不可取代原文" },
    ],
  });
  assert.equal(c.schedule[0].note, c.remarks);
  w.review(c, "nurse");
  w.review(c, "admin");
  assert.equal(w.state.emails.filter((m) => m.template_id === "T11").length, 0);
  w.act(token(c, "provide_unit").token, { unit: "12 樓 B 室" });
  const mail = w.state.emails.find((m) => m.template_id === "T11");
  assert.equal(mail.to, "n01@example.test");
  for (const value of [
    "80／M",
    "160cm／60kg",
    "需人輔助",
    "糖尿病",
    "疼痛",
    "請慢慢扶起",
    "12 樓 B 室",
  ])
    assert.ok(mail.body.includes(value));
  assert.ok(!mail.body.includes(c.email));
});
test("v3 manual corrections revalidate clinical facts and cannot bypass payment or red flags", (t) => {
  const { w, token } = fixture(t);
  const c = w.create(
    input({
      services: [{ id: "ng-change" }],
      existing_tube: "UNSURE",
      doctor_order: "UNSURE",
    }),
  );
  assert.equal(c.status, "MANUAL");
  assert.throws(() => w.adminCase(c, "issue_quote", { reason: "已跟進" }));
  assert.throws(() =>
    w.adminCase(c, "correct_intake", {
      reason: "已跟進",
      doctor_order: "NA",
      existing_tubes: { "ng-change": "YES" },
    }),
  );
  w.adminCase(c, "correct_intake", {
    reason: "家屬確認已有醫生紙及現有喉管",
    doctor_order: "YES",
    existing_tubes: { "ng-change": "YES" },
  });
  assert.equal(c.status, "MANUAL");
  assert.equal(c.doctor_order_status, "PENDING_CHECK");
  w.adminCase(c, "issue_quote", { reason: "重新驗證後發報價" });
  assert.equal(c.status, "QUOTED");
  assert.equal(c.intake_corrections.length, 1);
  w.act(token(c, "accept_single").token);
  assert.throws(() =>
    w.adminCase(c, "correct_intake", {
      reason: "不可更改付款中個案",
      doctor_order: "NO",
    }),
  );
});
test("v3 holiday catalogue carries bilingual names and independent official source evidence", (t) => {
  const { w } = fixture(t);
  assert.equal(w.state.holidays.length, 34);
  assert.ok(
    w.state.holidays.every(
      (h) =>
        h.name_zh &&
        h.name_en &&
        h.year &&
        h.source_url &&
        h.fetched_at &&
        h.verified_source_url,
    ),
  );
});
test("v3 multiple requested visits persist for manual review and cannot be quoted as one visit", (t) => {
  const { w } = fixture(t);
  const visits = [
    { date: "2026-11-10", shift: "DAY", start: "18:00", end: "22:00" },
    { date: "2026-11-10", shift: "NIGHT10", start: "22:00", end: "08:00" },
  ];
  const c = w.create(
    input({
      start: "18:00",
      end: "22:00",
      services: [{ id: "vitals", times: ["20:00"] }],
      visits,
    }),
  );
  assert.equal(c.status, "MANUAL");
  assert.deepEqual(
    c.visits.map(({ date, shift, start, end }) => ({
      date,
      shift,
      start,
      end,
    })),
    visits,
  );
  assert.throws(
    () => w.adminCase(c, "issue_quote", { reason: "不可只收第一段價錢" }),
    /多次上門/,
  );
  assert.ok(
    !w.state.emails.some((m) => m.case_id === c.id && m.template_id === "T1"),
  );
  assert.throws(
    () => w.create(input({ visits: [{ ...visits[0], date: "2026-02-30" }] })),
    /有效日期/,
  );
});
test("v3 existing databases receive new timer defaults without overwriting confirmed settings", (t) => {
  const { w } = fixture(t);
  const path = w.db.location();
  w.state.settings.day_rate = 310;
  delete w.state.settings.reminder_lead_minutes;
  w.save();
  const reopened = new Workflow(path);
  assert.equal(reopened.state.settings.day_rate, 310);
  assert.equal(reopened.state.settings.reminder_lead_minutes, 10);
  reopened.db.close();
});
test("v3 reminder retains payment decisions and expired payment links fail before the worker runs", (t) => {
  const { w, token, advance } = fixture(t);
  const c = w.create(input());
  w.act(token(c, "accept_single").token);
  const cancel = token(c, "cancel");
  advance(12 * 3600000);
  w.tick();
  const reminder = w.state.emails.find((m) => m.template_id === "T10");
  assert.ok(reminder.links.some((l) => l.url.endsWith(cancel.token)));
  advance(12 * 3600000);
  assert.equal(c.status, "PENDING_PAY");
  assert.throws(() => w.inspect(cancel.token), /付款時限已過/);
});
