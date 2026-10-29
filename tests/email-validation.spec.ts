import { test, expect } from "@playwright/test";

test("email validation UI completes a real server workflow with safe confirmation pages", async ({
  page,
  context,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.goto("/#staff");
  await page
    .getByRole("button", { name: "Email validation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Email validation workspace" }),
  ).toBeVisible();
  await expect(
    page.getByText("Local test inbox", { exact: true }),
  ).toBeVisible();
  const headers = {
    Authorization: "Bearer " + (process.env.WORKFLOW_ADMIN_KEY || ""),
  };
  const state = await (
    await page.request.get("/api/workflow", { headers })
  ).json();
  if (state.settings.nurse_day_rate === null) {
    await page
      .getByText("Test settings and admin connection", { exact: true })
      .click();
    await page.getByLabel("Day nurse rate (test)").fill("245");
    await page.getByLabel("Night nurse rate (test)").fill("270");
    await page
      .getByRole("button", {
        name: "Select full experiment policies (save to confirm)",
      })
      .click();
    await page.getByRole("button", { name: "Confirm test settings" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page.getByLabel("Email (required)").fill("family@example.test");
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Service date").fill(future);
  await page.getByRole("checkbox", { name: /All data is fictional/ }).check();
  await page
    .getByRole("button", { name: "Confirm details and submit" })
    .click();
  await page
    .getByRole("button", { name: "Confirm enquiry submission", exact: true })
    .click();
  await expect(page.locator(".ev-state")).toContainText("MANUAL");
  await page
    .getByText("Manual review, cancellation, refunds and reposting", {
      exact: true,
    })
    .click();
  await page.getByLabel("Review / action reason").fill("核對虛構地點及資料");
  await page
    .getByRole("button", { name: "Review location / allowance", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Issue quote after review", exact: true })
    .click();
  await expect(page.locator(".ev-state")).toContainText("QUOTED");
  await expect(
    page.getByRole("button", {
      name: "Approve preview and dispatch",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: /Test inbox/ }).click();
  await page
    .locator(".ev-mail-list button")
    .filter({ hasText: "T1 ·" })
    .first()
    .click();
  const accept = page.getByRole("link", { name: "30 小時套餐", exact: true });
  const popupPromise = context.waitForEvent("page");
  await accept.click();
  const popup = await popupPromise;
  await expect(
    popup.getByRole("heading", { name: "30 小時套餐", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("tab", { name: "Cases", exact: true }).click();
  await expect(page.locator(".ev-state")).toContainText("QUOTED");
  await popup
    .getByRole("button", { name: "確認：30 小時套餐", exact: true })
    .click();
  await expect(popup.getByRole("heading", { name: "操作結果" })).toBeVisible();
  await popup.close();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".ev-state")).toContainText("PENDING_PAY");
  await page.getByRole("tab", { name: /Test inbox/ }).click();
  await page
    .locator(".ev-mail-list button")
    .filter({ hasText: "T8b ·" })
    .click();
  const fpsPagePromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "提交轉帳資料" }).click();
  const fpsPage = await fpsPagePromise;
  await fpsPage.getByLabel("轉帳參考編號").fill("CUSTOMER-PACKAGE-001");
  await fpsPage.getByLabel("轉帳金額 HKD").fill("8650");
  const now = Date.now() + 30000;
  const hkt = new Date(now + 8 * 3600000).toISOString().slice(0, 16);
  await fpsPage.getByLabel("轉帳時間 HKT").fill(hkt);
  await fpsPage.getByRole("button", { name: "確認：提交轉帳資料" }).click();
  await expect(fpsPage.getByText(/尚未確認收款/)).toBeVisible();
  await fpsPage.close();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("tab", { name: "Cases", exact: true }).click();
  await expect(page.locator(".ev-state")).toContainText("PENDING_PAY");
  await page.getByLabel("Pending transfer report").selectOption({ index: 1 });
  await page
    .getByLabel("Bank receipt / refund reference")
    .fill("BANK-PACKAGE-001");
  await page.getByLabel("Verified amount HKD").fill("8650");
  await page.getByLabel("Bank receipt / refund time HKT").fill(hkt);
  await page
    .getByLabel("Reconciliation / refund note")
    .fill("已核對虛構銀行入帳");
  await page.getByRole("checkbox", { name: /I independently checked/ }).check();
  await page
    .getByRole("button", {
      name: "Confirm bank receipt after reconciliation",
      exact: true,
    })
    .click();
  await expect(page.locator(".ev-state")).toContainText("PAID");
  await page
    .getByRole("button", { name: "Approve preview and dispatch", exact: true })
    .click();
  await expect(page.locator(".ev-state")).toContainText("POSTED");
  await page.getByRole("tab", { name: /Test inbox/ }).click();
  await page
    .locator(".ev-mail-list button")
    .filter({ hasText: "T3 · n01@example.test" })
    .click();
  const nursePromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "我要做此個案" }).click();
  const nurse = await nursePromise;
  await nurse.getByRole("button", { name: "確認：我要做此個案" }).click();
  await nurse.close();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .locator(".ev-mail-list button")
    .filter({ hasText: "T16 · family@example.test" })
    .click();
  const familyPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "填寫單位" }).click();
  const family = await familyPromise;
  await family.getByLabel("樓層及單位").fill("38 樓 X 室");
  await family.getByRole("button", { name: "確認：填寫單位" }).click();
  await family.close();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("tab", { name: "Cases", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate rules draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Senior nurse review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yi final approval", exact: true })
    .click();
  await expect(page.locator(".ev-state")).toContainText("READY");
  await page.getByRole("tab", { name: /Test inbox/ }).click();
  await page
    .locator(".ev-mail-list button")
    .filter({ hasText: "T11 · n01@example.test" })
    .click();
  await expect(page.locator(".ev-panel pre")).toContainText("38 樓 X 室");
  const firstT11 = page.locator(".ev-panel");
  const arriveUrl = await firstT11
    .getByRole("link", { name: "已到達", exact: true })
    .getAttribute("href");
  const doneUrl = await firstT11
    .getByRole("link", { name: "完成", exact: true })
    .getAttribute("href");
  await page.getByRole("tab", { name: "Cases", exact: true }).click();
  await page
    .getByText("Virtual clock (not real 24h evidence)", { exact: true })
    .click();
  await page.getByLabel("Advance to HKT").fill(future + "T10:00");
  await page
    .getByRole("button", { name: "Advance virtual clock", exact: true })
    .click();
  await page.request.post(arriveUrl!);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".ev-state")).toContainText("IN_SERVICE");
  await page.getByLabel("Advance to HKT").fill(future + "T14:00");
  await page
    .getByRole("button", { name: "Advance virtual clock", exact: true })
    .click();
  await page.request.post(doneUrl!);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".ev-state")).toContainText("DONE");
  await page.getByRole("tab", { name: "Ledgers", exact: true }).click();
  await expect(page.locator(".ev-event-table")).toContainText("DEDUCT");
  await expect(
    page.getByText("Nurse payouts: records only, no transfers"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Acceptance", exact: true }).click();
  await page.getByLabel("Acceptance ID / experiment").fill("FPS-PACKAGE-E2E");
  await page
    .getByLabel("Observations / conditions")
    .fill(
      "Browser test: fictional FPS report, admin reconciliation, package completion under virtual clock",
    );
  await page
    .getByRole("button", { name: "Append observation", exact: true })
    .click();
  await expect(
    page.locator(".ev-gates").filter({ hasText: "FPS-PACKAGE-E2E" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Evidence", exact: true }).click();
  await expect(page.locator(".ev-event-table")).toContainText("lock.won");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export events/ }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain('"admin"');
  expect(csv).toContain('"nurse"');
  expect(csv).not.toContain("BANK-PACKAGE-001");
  expect(csv).not.toContain("38 樓 X 室");
  await page.getByRole("tab", { name: "Cases", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("email-workspace-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of [
    "Cases",
    /Test inbox/,
    "Ledgers",
    "Acceptance",
    "Evidence",
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.screenshot({
    path: testInfo.outputPath("email-workspace-mobile.png"),
    fullPage: true,
  });
});
