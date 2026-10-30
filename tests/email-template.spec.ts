import { test, expect } from "@playwright/test";

test("Messages previews the branded email and keeps its layout on mobile", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.route("**/api/workflow", async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    await route.fulfill({
      response,
      json: {
        ...state,
        emails: [
          {
            id: "email-preview-fixture",
            case_id: "CK-1024",
            template_id: "T1",
            template_version: "v3-email-trl3-2",
            subject: "上門護理報價 – Case CK-1024",
            to: "family@careknock.invalid",
            status: "captured",
            body: "你好，陳先生／女士。多謝你查詢上門護理服務。\n服務：2026-11-10 10:00–14:00\n服務內容：量血壓、傷口護理\n總額：HK$1220\n\n轉帳資料須由同事核對銀行入帳。",
            links: [
              {
                label: "accept_single",
                url: "https://careknock.invalid/a/preview",
              },
              {
                label: "cancel",
                url: "https://careknock.invalid/a/cancel-preview",
              },
            ],
          },
        ],
      },
    });
  });
  await page.goto("/#staff/messages");
  await page
    .locator(".staff-client > summary")
    .filter({ hasText: "CK-1024" })
    .click();
  const preview = page.frameLocator('iframe[title="CareKnock email preview"]');
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "上門護理報價 – Case CK-1024",
  );
  await expect(
    preview.getByRole("link", { name: "接受單次報價", exact: true }),
  ).toHaveAttribute("href", "https://careknock.invalid/a/preview");
  await expect(preview.getByText("總額", { exact: true })).toBeVisible();
  await expect(preview.getByText("HK$1220", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("email-preview-desktop.png"),
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page
      .locator('iframe[title="CareKnock email preview"]')
      .evaluate((frame, size) => {
        frame.style.width = `${size}px`;
        frame.style.maxWidth = "100%";
      }, width - 32);
    expect(
      await preview
        .locator("body")
        .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("email-preview-mobile.png"),
    fullPage: true,
  });
  await page.getByText("Plain text content", { exact: true }).click();
  await expect(page.locator(".staff-client pre")).toContainText(
    "轉帳資料須由同事核對銀行入帳",
  );
});
