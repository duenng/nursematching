import { test, expect } from "@playwright/test";

const baseCase = {
  id: "C-UX-001",
  surname: "陳女士",
  patient_ref: "PATIENT-01",
  email: "family@example.test",
  phone: "61234567",
  date: "2026-11-07",
  start: "10:00",
  end: "14:00",
  district: "東區",
  building: "測試大廈",
  quote: { total: 1220 },
  order_type: "SINGLE",
  address_status: "PENDING",
  schedule_status: "PENDING",
  services: [],
};

async function mockWorkspace(
  page: import("@playwright/test").Page,
  cases: object[],
  submissions: object[] = [],
) {
  const workspace = await (await page.request.get("/api/workflow")).json();
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "zh-HK"),
  );
  await page.route("**/api/workflow", (route) =>
    route.fulfill({
      json: {
        ...workspace,
        cases,
        payment_submissions: submissions,
        payment_reconciliations: [],
        emails: [],
        events: [],
      },
    }),
  );
}

test("cancelled case shows a labelled summary without inactive finance fields or expanded dispatch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(page, [{ ...baseCase, status: "CANCELLED" }]);
  await page.goto("/#staff/requests/C-UX-001");
  const detail = page.locator(".ev-case-panel");
  await expect(detail.locator(".ev-case-badge")).toHaveText("已取消");
  await expect(detail).toContainText("此個案已取消，毋須再派單");
  await expect(detail.getByText("服務時間 · 香港")).toBeVisible();
  await expect(detail.getByRole("link", { name: "61234567" })).toHaveAttribute(
    "href",
    "tel:61234567",
  );
  await expect(detail.getByRole("textbox")).toHaveCount(0);
  await expect(
    detail.getByRole("button", { name: "確認預覽並派單" }),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/case-cancelled-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/case-cancelled-desktop.png",
    fullPage: true,
  });
});

test("reconciliation requires a selected report and verified record, and clears when switching cases", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(
    page,
    [
      {
        ...baseCase,
        status: "PENDING_PAY",
        payment_review_status: "PENDING_REVIEW",
      },
      {
        ...baseCase,
        id: "C-UX-002",
        status: "PENDING_PAY",
        payment_review_status: "PENDING_REVIEW",
      },
    ],
    [
      {
        id: "REPORT-1",
        case_id: "C-UX-001",
        reference: "FAMILY-1",
        amount: 1220,
        status: "PENDING_REVIEW",
      },
      {
        id: "REPORT-2",
        case_id: "C-UX-002",
        reference: "FAMILY-2",
        amount: 1220,
        status: "PENDING_REVIEW",
      },
    ],
  );
  await page.goto("/#staff/requests/C-UX-001");
  const finance = page.getByRole("region", { name: "收款及退款" });
  const confirm = finance.getByRole("button", {
    name: "確認銀行入帳，完成對數",
  });
  await expect(confirm).toBeDisabled();
  await finance.getByRole("combobox").selectOption("REPORT-1");
  await expect(finance.getByLabel("核實金額 HKD")).toHaveValue("1220");
  await finance.getByLabel("銀行入帳／退款轉帳參考").fill("BANK-1");
  await finance
    .getByLabel("銀行入帳／退款轉帳時間 HKT")
    .fill("2026-10-31T12:00");
  await finance.getByLabel("對數／退款說明").fill("已核實銀行紀錄");
  await expect(confirm).toBeDisabled();
  await finance.getByRole("checkbox").check();
  await expect(confirm).toBeEnabled();
  await finance.getByLabel("核實金額 HKD").fill("1200");
  await expect(confirm).toBeDisabled();
  await finance.getByLabel("核實金額 HKD").fill("1220");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/case-payment-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "查看個案" })
    .selectOption("C-UX-002");
  await expect(finance.getByLabel("銀行入帳／退款轉帳參考")).toHaveValue("");
  await expect(finance.getByLabel("對數／退款說明")).toHaveValue("");
  await expect(finance.getByRole("checkbox")).not.toBeChecked();
  await expect(confirm).toBeDisabled();
});

test("approved refund offers only refund recording and sends the entered bank record", async ({
  page,
}) => {
  await mockWorkspace(page, [
    {
      ...baseCase,
      status: "FULL_REFUND",
      refund_status: "APPROVED",
      refund_amount: 1220,
    },
  ]);
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/case-action", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/#staff/requests/C-UX-001");
  const finance = page.getByRole("region", { name: "收款及退款" });
  await expect(
    finance.getByRole("heading", { name: "記錄銀行退款" }),
  ).toBeVisible();
  await expect(finance.getByRole("combobox")).toHaveCount(0);
  await expect(
    finance.getByRole("button", { name: "確認銀行入帳，完成對數" }),
  ).toHaveCount(0);
  await finance.getByLabel("銀行入帳／退款轉帳參考").fill("REFUND-BANK-1");
  await finance.getByLabel("核實金額 HKD").fill("1220");
  await finance
    .getByLabel("銀行入帳／退款轉帳時間 HKT")
    .fill("2026-10-31T12:00");
  await finance.getByLabel("對數／退款說明").fill("銀行退款已完成");
  await finance.getByRole("checkbox").check();
  await finance.getByRole("button", { name: "記錄已完成轉帳退款" }).click();
  await expect.poll(() => submitted?.action).toBe("record_fps_refund");
  expect(submitted).toMatchObject({
    id: "C-UX-001",
    amount: 1220,
    bank_reference: "REFUND-BANK-1",
    verified: true,
    reason: "銀行退款已完成",
    received_at: "2026-10-31T04:00:00.000Z",
  });
});
