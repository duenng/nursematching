import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workflow } from "./workflow.mjs";
const H = 3600000;
const input = (extra) => ({
  surname: "陳",
  email: "family@example.test",
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
function setup(t, options = {}) {
  let now = Date.parse("2026-10-29T12:00:00+08:00");
  const dir = mkdtempSync(join(tmpdir(), "nurse-fps-"));
  const w = new Workflow(join(dir, "test.sqlite"), {
    now: () => now,
    paymentMode: "fps_test",
    fpsRecipient: "TEST-FPS-001",
    fpsAccountName: "TEST ACCOUNT",
    ...options,
  });
  Object.assign(w.state.settings, {
    nurse_day_rate: 245,
    nurse_night_rate: 270,
  });
  t.after(() => {
    w.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { w, advance: (ms) => (now += ms) };
}
const token = (w, c, a) =>
  w.state.tokens
    .filter(
      (t) => t.case_id === c.id && t.action === a && !t.used_at && !t.void_at,
    )
    .at(-1).token;
function pending(w, c) {
  w.act(token(w, c, "accept_single"));
  assert.equal(c.status, "PENDING_PAY");
}
function report(w, c, amount = 1220) {
  w.act(token(w, c, "report_fps"), {
    reference: "CUSTOMER-CLAIM",
    amount,
    transferred_at: new Date(w.now())
      .toISOString()
      .slice(0, 16)
      .replace("T04:", "T12:"),
  });
  return w.state.payment_submissions.at(-1);
}
function reconcile(w, c, sub, extra = {}) {
  return w.reconcileFPS(c, {
    submission_id: sub.id,
    bank_reference: "BANK-VERIFIED-001",
    amount: 1220,
    received_at: w.stamp(),
    verified: true,
    reason: "已核對虛構銀行入帳紀錄",
    ...extra,
  });
}

test("FPS customer report never authorizes payment or dispatch; independent admin reconciliation does", (t) => {
  const { w } = setup(t);
  const c = w.create(input());
  pending(w, c);
  const t8 = w.state.emails.find((m) => m.template_id === "T8");
  assert.match(t8.body, /TEST-FPS-001/);
  assert.match(t8.body, /TEST ACCOUNT/);
  assert.match(t8.body, /請勿實際轉帳/);
  assert.ok(!c.checkout_pending);
  assert.throws(() => w.paid(c), /管理員對數/);
  const link = token(w, c, "report_fps");
  w.inspect(link);
  assert.equal(w.state.payment_submissions.length, 0);
  const sub = report(w, c);
  assert.equal(c.status, "PENDING_PAY");
  assert.throws(() => w.dispatch(c));
  assert.throws(() => reconcile(w, c, sub, { verified: false }));
  assert.throws(() => reconcile(w, c, sub, { amount: 1000 }));
  assert.equal(c.status, "PENDING_PAY");
  reconcile(w, c, sub);
  assert.equal(c.status, "PAID");
  assert.equal(sub.status, "VERIFIED");
  assert.equal(c.amount_paid, 1220);
  w.dispatch(c);
  assert.equal(c.status, "POSTED");
  assert.ok(w.state.events.some((e) => e.event === "payment.fps_reconciled"));
});
test("FPS duplicate bank receipt cannot pay two cases; submission amount is not evidence", (t) => {
  const { w } = setup(t);
  const c = w.create(input());
  pending(w, c);
  const sub = report(w, c, 1);
  reconcile(w, c, sub);
  const d = w.create(input({ date: "2026-11-12" }));
  pending(w, d);
  const sub2 = report(w, d);
  assert.throws(() => reconcile(w, d, sub2), /重複/);
  assert.equal(d.status, "PENDING_PAY");
  assert.equal(w.state.payment_reconciliations.length, 1);
  reconcile(w, d, sub2, { bank_reference: "BANK-002" });
  assert.equal(d.status, "PAID");
});
test("FPS deadline with pending report escalates; timely bank receipt can be reconciled later", (t) => {
  const { w, advance } = setup(t);
  const c = w.create(input());
  pending(w, c);
  advance(23 * H);
  const sub = report(w, c);
  const bankAt = w.stamp();
  advance(2 * H);
  w.tick();
  assert.equal(c.status, "PENDING_PAY");
  assert.ok(c.fps_deadline_review_at);
  assert.ok(!w.state.emails.some((m) => m.template_id === "T10b"));
  assert.throws(() => reconcile(w, c, sub), /付款期限/);
  reconcile(w, c, sub, { received_at: bankAt });
  assert.equal(c.status, "PAID");
  const d = w.create(input({ date: "2026-11-12" }));
  pending(w, d);
  advance(24 * H);
  w.tick();
  assert.equal(d.status, "PAY_TIMEOUT");
  assert.throws(() => w.act(token(w, d, "report_fps"), {}));
});
test("FPS refund approval is separate from recorded bank transfer; no automatic refund", (t) => {
  const { w } = setup(t);
  const c = w.create(input());
  pending(w, c);
  reconcile(w, c, report(w, c));
  w.dispatch(c);
  const nurseToken = w.state.tokens.find(
    (t) => t.case_id === c.id && t.action === "take_case" && t.actor === "N01",
  ).token;
  w.act(nurseToken);
  w.act(token(w, c, "cancel"));
  assert.equal(c.status, "FULL_REFUND");
  w.approveRefund(c);
  assert.equal(c.status, "FULL_REFUND");
  assert.equal(c.refund_status, "APPROVED");
  assert.ok(!c.refund_pending);
  assert.ok(!c.refunded_at);
  assert.throws(() =>
    w.recordFPSRefund(c, {
      bank_reference: "REFUND-001",
      amount: 1000,
      verified: true,
      received_at: w.stamp(),
      reason: "測試",
    }),
  );
  w.recordFPSRefund(c, {
    bank_reference: "REFUND-001",
    amount: 1220,
    verified: true,
    received_at: w.stamp(),
    reason: "已核對虛構轉帳",
  });
  assert.equal(c.status, "CANCELLED");
  assert.equal(c.refund_provider, "fps_manual");
  assert.equal(c.refund_status, "DONE");
  assert.ok(!c.stripe_refund_id);
  assert.throws(() => w.recordFPSRefund(c, {}));
});

test("FPS rejected claim can be resubmitted before deadline and closes after deadline", (t) => {
  const { w, advance } = setup(t);
  const c = w.create(input());
  pending(w, c);
  let sub = report(w, c);
  w.rejectFPS(c, { submission_id: sub.id, reason: "銀行未見相符入帳" });
  assert.equal(c.status, "PENDING_PAY");
  assert.equal(sub.status, "REJECTED");
  assert.ok(token(w, c, "report_fps"));
  sub = report(w, c);
  advance(25 * H);
  w.tick();
  w.rejectFPS(c, { submission_id: sub.id, reason: "再次核對未見入帳" });
  assert.equal(c.status, "PAY_TIMEOUT");
  assert.equal(c.payment_review_status, "REJECTED");
});

test("bank transfer requires configured instructions and independent bank verification before dispatch", (t) => {
  const { w } = setup(t, { paymentMode: "bank_transfer" });
  const c = w.create(input());
  const accept = token(w, c, "accept_single");
  assert.throws(() => w.act(accept), /收款銀行資料未設定/);
  assert.equal(c.status, "QUOTED");
  assert.ok(!w.state.tokens.find((entry) => entry.token === accept).used_at);
  assert.ok(!w.state.emails.some((mail) => mail.template_id === "T8"));
  w.bankName = "Fixture Bank";
  w.bankAccountName = "Fixture Company";
  w.bankAccountNumber = "000-123-456";
  // Failed transactions restore state; obtain the current case object.
  const current = w.state.cases.find((entry) => entry.id === c.id);
  pending(w, current);
  const email = w.state.emails.find((mail) => mail.template_id === "T8");
  assert.match(email.body, /Fixture Bank/);
  assert.match(email.body, /Fixture Company/);
  assert.match(email.body, /000-123-456/);
  assert.doesNotMatch(email.body, /FPS|虛構|模擬|請勿實際轉帳/);
  assert.throws(() => w.paid(current), /管理員對數/);
  const active = w.state.cases.find((entry) => entry.id === c.id);
  const sub = report(w, active);
  assert.equal(sub.test_only, false);
  assert.equal(active.status, "PENDING_PAY");
  assert.throws(() => w.dispatch(active));
  const latest = w.state.cases.find((entry) => entry.id === c.id);
  reconcile(w, latest, sub);
  assert.equal(latest.status, "PAID");
  assert.equal(w.state.payment_reconciliations.at(-1).test_only, false);
  w.dispatch(latest);
  assert.equal(latest.status, "POSTED");
  const nurseToken = w.state.tokens.find(
    (entry) =>
      entry.case_id === latest.id &&
      entry.action === "take_case" &&
      entry.actor === "N01",
  ).token;
  w.act(nurseToken);
  w.act(token(w, latest, "cancel"));
  w.approveRefund(latest);
  assert.equal(latest.refund_status, "APPROVED");
  assert.ok(!latest.refunded_at);
  w.recordFPSRefund(latest, {
    bank_reference: "BANK-REFUND-001",
    amount: 1220,
    verified: true,
    received_at: w.stamp(),
    reason: "Bank refund checked",
  });
  assert.equal(latest.status, "CANCELLED");
  assert.equal(latest.refund_provider, "bank_transfer");
});
