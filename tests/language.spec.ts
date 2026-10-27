import { test, expect } from "@playwright/test";

test("Traditional Chinese is the default and language selection persists across views and reloads", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-HK");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "在家多一點支援",
  );
  await page.getByText("我可以為自己安排護理嗎？", { exact: true }).click();
  await expect(page.locator(".patient-faq-list details").first()).toContainText(
    "你可為自己或親友查詢",
  );
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little help at home",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "EN", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Explore the staff demo" }).click();
  await expect(page.getByLabel("Search workspace")).toBeVisible();
  await page.getByRole("button", { name: "繁中", exact: true }).click();
  await expect(page.getByLabel("搜尋工作區")).toBeVisible();
  for (const name of [
    "護理查詢",
    "護理申請",
    "護理日程",
    "護理人員",
    "訊息",
    "服務對象紀錄",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      name === "訊息" ? "護理訊息" : name,
    );
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "護理申請", exact: true })
    .click();
  await page
    .getByLabel("個案狀態", { exact: true })
    .selectOption("Under review");
  await expect(page.getByLabel("個案狀態", { exact: true })).toHaveValue(
    "Under review",
  );
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("搜尋工作區").fill("HK-0024");
  await page.locator(".search-results").getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText("護理申請詳情");
  await page.getByRole("button", { name: "關閉對話框" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-HK");
  expect(errors).toEqual([]);
});

test("Chinese enquiry, corrections and visit approval retain their workflow values", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "立即查詢", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "試用廣東話範例" }).click();
  const enquiry = await dialog.getByLabel("你需要甚麼協助？").inputValue();
  await dialog.getByRole("button", { name: "EN", exact: true }).click();
  await expect(dialog.getByLabel("How can we help?")).toHaveValue(enquiry);
  await dialog.getByRole("button", { name: "繁中", exact: true }).click();
  await expect(dialog.getByLabel("你需要甚麼協助？")).toHaveValue(enquiry);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "整理查詢" }).click();
  await dialog.getByLabel("服務對象姓名／稱呼").fill("測試陳女士");
  await dialog.getByLabel("查詢服務地區").selectOption("Sha Tin");
  await expect(dialog.getByLabel("查詢服務地區")).toHaveValue("Sha Tin");
  await dialog.getByRole("button", { name: "提交護理查詢" }).click();
  await expect(page.locator(".patient-request-person")).toContainText(
    "測試陳女士",
  );
  await expect(page.locator(".patient-request-person")).toContainText("沙田");
  await expect(page.locator(".patient-request-details")).toContainText("週一");
  await page.getByRole("button", { name: "核對或修正我的資料" }).click();
  await dialog.getByLabel("期望到訪時間").fill("下午");
  await dialog.getByRole("button", { name: "儲存我的修正" }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator(".patient-request-person")).toContainText(
    "測試陳女士",
  );
  await expect(page.locator(".patient-request-details")).toContainText("下午");
  await page.reload();
  await expect(page.locator(".patient-request-person")).toContainText(
    "測試陳女士",
  );
  await page.evaluate(() => localStorage.removeItem("kindred-patient-preview"));
  await page.reload();
  await page.getByRole("button", { name: "繁中", exact: true }).click();
  await page.getByRole("button", { name: "查看建議到訪", exact: true }).click();
  await expect(dialog.locator(".patient-dialog-date")).toContainText("月");
  await dialog.getByRole("button", { name: "同意此次到訪" }).click();
  await expect(dialog.getByRole("alert")).toContainText("請確認已核對");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "同意此次到訪" }).click();
  await expect(dialog.locator(".patient-dialog-status .badge")).toHaveText(
    "已確認",
  );
});

test("switching languages preserves expanded services and mobile pages fit the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /上門護士護理/ }).click();
  await expect(page.locator("#clinic-service-details")).toContainText(
    "根據已確認的專業指示",
  );
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("#clinic-service-details")).toContainText(
    "Nursing support for needs",
  );
  await page.getByRole("button", { name: "繁中", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/kindred-zh-mobile-home.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "開啟服務對象選單" }).click();
  await page
    .getByRole("navigation", { name: "服務對象選單" })
    .getByRole("button", { name: "我的護理" })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "查看建議到訪", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "關閉對話框" }).click();
  await page.getByRole("button", { name: "探索職員示範介面" }).click();
  await expect(
    page.getByRole("button", { name: "EN", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/kindred-zh-mobile-staff.png",
    fullPage: true,
  });
});
