import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.setItem("kindred-language", "en");
    localStorage.setItem(
      "kindred-care-v3",
      JSON.stringify({ cases: [{ name: "BROWSER SECRET DEMO" }] }),
    );
  });
});

test("staff pages use shared server records without seeded profiles, fake trends or browser storage", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#staff");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
  await expect(page.locator("main")).not.toContainText("BROWSER SECRET DEMO");
  await expect(page.locator("main")).not.toContainText("Mr. Chan");
  await expect(page.locator("main")).not.toContainText("Alex");
  for (const name of [
    "Care enquiries",
    "Care requests",
    "Care schedule",
    "Care providers",
    "Messages",
    "Client records",
    "Ledgers",
    "Settings",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.locator("main")).not.toContainText("Reset demo");
  }
  await expect(page.locator(".mock-sandbox")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("provider directory saves verified records on the server and survives a new browser session", async ({
  page,
  browser,
}) => {
  await page.goto("/#staff/providers");
  await page.getByRole("button", { name: "Add provider", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Provider details" });
  const email = `verified-${Date.now()}@careknock.invalid`;
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Credential test nurse");
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("VERIFIED");
  await dialog.getByLabel("Registration number").fill("RN-TEST");
  await dialog
    .getByLabel("Verification record / notes")
    .fill("Verified current registration with supporting documents");
  await dialog.getByRole("button", { name: "Save provider" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Save provider" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: email })).toContainText(
    "Verified",
  );
  const other = await browser.newContext();
  const second = await other.newPage();
  await second.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await second.goto(`${test.info().project.use.baseURL}/#staff/providers`);
  await expect(
    second.getByRole("row").filter({ hasText: email }),
  ).toContainText("RN-TEST");
  await other.close();
});

test("staff requests show connection failures without falling back to demonstration records", async ({
  page,
}) => {
  await page.route("**/api/workflow", (route) =>
    route.fulfill({ status: 503, json: { error: "Database unavailable" } }),
  );
  await page.goto("/#staff/requests");
  await expect(page.getByRole("alert")).toContainText("Database unavailable");
  await expect(page.locator("main")).not.toContainText("Mr. Chan");
  await expect(page.locator("table")).toHaveCount(0);
});

test("manual case saves location review before quoting and displays action results beside controls", async ({
  page,
}) => {
  const origin = String(test.info().project.use.baseURL);
  const response = await page.request.post(`${origin}/api/enquiries`, {
    headers: { Origin: origin },
    data: {
      surname: "Fixture",
      email: "quote-fixture@example.test",
      patient_ref: "QUOTE-FIXTURE",
      consent: true,
      gender: "M",
      age: 78,
      weight_kg: 65,
      height_cm: 165,
      mobility: "需人輔助",
      companion: "YES",
      district: "東區",
      building: "Fixture building",
      date: "2026-11-10",
      shift: "DAY",
      start: "10:00",
      end: "14:00",
      doctor_order: "NA",
      services: [{ id: "vitals", times: ["12:00"], prn: false }],
    },
  });
  expect(response.ok()).toBeTruthy();
  const { id } = await response.json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#staff/requests/${id}`);
  const controls = page.locator(".ev-admin");
  await controls.locator("summary").first().click();
  const issue = controls.getByRole("button", {
    name: "Issue quote after review",
    exact: true,
  });
  await expect(issue).toBeDisabled();
  await expect(controls).toContainText("Location review is not saved:");
  await controls
    .getByRole("button", { name: "Review location / allowance", exact: true })
    .click();
  await expect(controls.getByRole("alert")).toContainText(
    "請選擇地區分類並填覆核原因",
  );
  await expect(controls.getByRole("alert")).toBeInViewport();
  await controls
    .getByLabel("Review / action reason")
    .fill("Address and services verified with the family");
  await controls.getByRole("combobox").selectOption("C");
  await controls
    .getByRole("button", { name: "Review location / allowance", exact: true })
    .click();
  await expect(
    controls.locator('[role="status"][tabindex="-1"]'),
  ).toContainText("Location and allowance review saved.");
  await expect(issue).toBeEnabled();
  await issue.click();
  await expect(
    controls.locator('[role="status"][tabindex="-1"]'),
  ).toContainText("Quote created and queued for email delivery.");
  await expect(page.locator(".ev-state")).toContainText("Quote sent");
  const workspace = await (
    await page.request.get(`${origin}/api/workflow`)
  ).json();
  expect(
    workspace.cases.find((c: { id: string }) => c.id === id).quote.total,
  ).toBe(1220);
  expect(
    workspace.emails.filter(
      (m: { case_id: string; template_id: string }) =>
        m.case_id === id && m.template_id === "T1",
    ),
  ).toHaveLength(1);
});

test("mobile staff navigation and provider form fit the screen", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#staff");
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Care providers", exact: true })
    .click();
  await page.getByRole("button", { name: "Add provider", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await page
    .locator(".sidebar")
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await page.screenshot({
    path: info.outputPath("live-staff-mobile.png"),
    fullPage: true,
  });
});
