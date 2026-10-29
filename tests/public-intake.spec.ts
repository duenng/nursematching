import { test, expect } from "@playwright/test";

test("family submits a server enquiry without staff login; privileged data stays private", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  let staffReads = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/workflow")) staffReads++;
  });
  await page.goto("/#enquire");
  await expect(
    page.getByRole("heading", { name: "Home nursing test enquiry" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Test inbox/ })).toHaveCount(0);
  await expect(page.getByLabel("Admin key")).toHaveCount(0);
  await page.getByLabel("Email (required)").fill("family@example.test");
  await page
    .getByLabel("Patient reference (package owner)")
    .fill("PUBLIC-TEST-1");
  await page
    .getByLabel("Service date")
    .fill(new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10));
  await page.getByRole("checkbox", { name: /All data is fictional/ }).check();
  await page
    .getByRole("button", { name: "Confirm details and submit", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const responsePromise = page.waitForResponse((r) =>
    r.url().endsWith("/api/enquiries"),
  );
  await page
    .getByRole("button", { name: "Confirm enquiry submission", exact: true })
    .click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(Object.keys(data).sort()).toEqual(["id", "status"]);
  expect(data.status).toBe("MANUAL");
  await expect(page.getByRole("status")).toContainText("Enquiry received");
  expect(staffReads).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("family-receipt-mobile.png"),
    fullPage: true,
  });
});
