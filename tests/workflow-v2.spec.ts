import { test, expect } from "@playwright/test";

test("v2 guided enquiry validates required fields and previews Hong Kong pricing", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.goto("/#patient");
  await page.getByRole("button", { name: "Enquire now", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Use the structured care form" })
    .click();

  await dialog.getByRole("button", { name: "Organise enquiry" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "complete all required",
  );

  await dialog.getByLabel("Patient surname").fill("Chan");
  await dialog.getByLabel("Gender").selectOption("Male");
  await dialog.getByLabel("Patient age (years)").fill("82");
  await dialog.getByLabel("District").selectOption("Sha Tin");
  await dialog.getByLabel("Building / estate / village").fill("Sunshine Court");
  await dialog.getByLabel("Weight (kg)").fill("65");
  await dialog.getByLabel("Height (cm)").fill("165");
  await dialog.getByLabel("Email address").fill("family@example.test");
  await dialog
    .locator('select[aria-label="Mobility"]')
    .selectOption({ label: "Needs assistance" });
  await dialog
    .locator('select[aria-label="Someone at home during service"]')
    .selectOption("Yes");
  await dialog
    .locator(".guided-service-row")
    .filter({ hasText: "Vital signs monitoring" })
    .first()
    .getByRole("checkbox")
    .first()
    .check();
  await dialog
    .getByLabel("Vital signs monitoring preferred times")
    .fill("09:00");
  await dialog.getByLabel("Start time").fill("09:00");
  await dialog.getByLabel("End time").fill("11:00");
  await dialog.getByRole("checkbox", { name: /fictional information/ }).check();
  await dialog.getByRole("button", { name: "Organise enquiry" }).click();

  await expect(dialog).toContainText("HK$1,220");
  await expect(dialog).toContainText(
    "Materials and tools are supplied by the client",
  );
  await dialog.getByRole("button", { name: "Submit my care enquiry" }).click();
  await expect(page.locator(".patient-request-person")).toContainText("Chan");
  await page.getByRole("button", { name: "Explore the staff demo" }).click();
  await page.getByLabel("Search workspace").fill("Chan");
  await page
    .locator(".search-results")
    .getByRole("button", { name: /Chan.*HK-0025/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Vital signs monitoring",
  );
  await expect(page.getByRole("dialog")).toContainText("HK$1,220");
});

test("mock integrations sandbox runs payment, dispatch, assignment, drop and onboarding flows", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.goto("/#staff");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const sandbox = page.locator(".mock-sandbox");
  await expect(sandbox).toContainText("MOCK ONLY");
  await sandbox.getByRole("button", { name: /Generate mock quote/ }).click();
  await sandbox.getByRole("button", { name: /Mark mock payment paid/ }).click();
  await expect(sandbox).toContainText("Paid");
  await sandbox
    .getByRole("button", { name: /Send mock email dispatch/ })
    .click();
  await sandbox
    .getByRole("button", { name: /First eligible nurse accepts/ })
    .click();
  await expect(sandbox).toContainText("Assigned");
  await sandbox.getByRole("button", { name: /Mock nurse cancels/ }).click();
  await expect(sandbox).toContainText("Rematching");
  await sandbox.getByRole("button", { name: /Mock full refund/ }).click();
  await expect(sandbox).toContainText("Full refund");
  await sandbox.getByLabel("Demo nurse").selectOption("P-006");
  await sandbox.getByRole("button", { name: /Mock interview/ }).click();
  await expect(sandbox).toContainText("已核實");
});
