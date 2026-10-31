import test from "node:test";
import assert from "node:assert/strict";
import {
  validateTransferReport,
  TransferReportError,
  transferReportForm,
} from "./transfer-report.mjs";

const c = {
  id: "TEST-1",
  created_at: "2026-10-31T04:05:42Z",
  payment_amount: 1220,
};
const now = Date.parse("2026-10-31T15:30:00+08:00");
const valid = {
  reference: " BANK-001 ",
  amount: "1220",
  transfer_date: "2026-10-31",
  transfer_hour: "15",
  transfer_minute: "25",
};

test("transfer timestamps use Hong Kong time, retain minute precision and accept existing email form format", () => {
  assert.deepEqual(validateTransferReport(valid, c, now), {
    reference: "BANK-001",
    amount: 1220,
    transferred_at: "2026-10-31T07:25:00.000Z",
  });
  assert.equal(
    validateTransferReport(
      { reference: "BANK-2", amount: 1220, transferred_at: "2026-10-31T12:05" },
      c,
      now,
    ).transferred_at,
    "2026-10-31T04:05:00.000Z",
  );
});

test("transfer validation identifies fields, invalid dates, past and future times without normalising bad inputs", () => {
  for (const [input, field, pattern] of [
    [{ ...valid, reference: " " }, "reference", /參考編號/],
    [{ ...valid, amount: "1,220" }, "amount", /正整數/],
    [{ ...valid, amount: "12.5" }, "amount", /正整數/],
    [{ ...valid, amount: 0 }, "amount", /正整數/],
    [{ ...valid, amount: Number.MAX_SAFE_INTEGER + 1 }, "amount", /正整數/],
    [{ ...valid, transfer_date: "2026-02-30" }, "transferred_at", /完整有效/],
    [{ ...valid, transfer_hour: "24" }, "transferred_at", /完整有效/],
    [{ ...valid, transfer_minute: "" }, "transferred_at", /完整有效/],
    [
      { ...valid, transfer_hour: "12", transfer_minute: "04" },
      "transferred_at",
      /不可早於.*2026-10-31 12:05/,
    ],
    [{ ...valid, transfer_hour: "16" }, "transferred_at", /不可在未來/],
  ])
    assert.throws(
      () => validateTransferReport(input, c, now),
      (error) =>
        error instanceof TransferReportError &&
        error.status === 400 &&
        pattern.test(error.errors[field]),
    );
});

test("transfer correction form escapes submitted values, preserves choices and explains bank time", () => {
  const html = transferReportForm(
    c,
    'token"<',
    now,
    "fps_test",
    { ...valid, reference: '"><script>bad</script>' },
    { transferred_at: "時間有誤" },
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /value="15" selected/);
  assert.match(html, /value="25" selected/);
  assert.match(html, /value="2026-10-31"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /並非上門服務日期/);
  assert.match(html, /尚未提交/);
});

for (const mode of ["payme", "bank_transfer"]) {
  test(`${mode} payment form accepts one screenshot without typed transfer details`, () => {
    const form = transferReportForm(c, 'token"<', now, mode);
    assert.match(form, /multipart\/form-data/);
    assert.match(form, /name="screenshot"/);
    assert.doesNotMatch(
      form,
      /name="(?:reference|amount|transfer_date|transfer_hour|transfer_minute)"/,
    );
    assert.match(form, /token&quot;&lt;/);
    assert.match(form, /5 MB/);
    assert.match(form, /先可確認收款及派單/);
  });
}
