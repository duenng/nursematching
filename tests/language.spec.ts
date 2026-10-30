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
  await page.goto("/#staff/requests");
  await expect(page.getByLabel("Search workspace")).toBeVisible();
  await page.getByRole("button", { name: "繁中", exact: true }).click();
  await expect(page.getByLabel("搜尋工作區")).toBeVisible();
  for (const name of [
    "護理查詢",
    "護理個案",
    "護理排程",
    "護理人員",
    "電郵通知",
    "客戶紀錄",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-HK");
  expect(errors).toEqual([]);
});

test("Chinese homepage opens the server enquiry with meaningful data-use consent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "立即查詢", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "上門護理查詢", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "我同意將以上資料保存，用於跟進查詢、報價及安排服務。",
    }),
  ).toBeVisible();
  await expect(page.getByText(/我正使用虛構資料進行示範/)).toHaveCount(0);
  await expect(page.getByLabel("姓氏", { exact: true })).toHaveValue("");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "上門護理查詢", exact: true }),
  ).toBeVisible();
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
  await page.goto("/#staff");
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
