import { test, expect } from "@playwright/test";

test("v2 guided enquiry validates required fields and previews Hong Kong pricing", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kindred-language", "en"));
  await page.goto("/#patient");
  await page.getByRole("button", { name: "Enquire now", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Use the structured care form" }).click();

  await dialog.getByRole("button", { name: "Organise enquiry" }).click();
  await expect(dialog.getByRole("alert")).toContainText("complete all required");

  await dialog.getByLabel("Patient surname").fill("Chan");
  await dialog.getByLabel("Gender").selectOption("Male");
  await dialog.getByLabel("Patient age (years)").fill("82");
  await dialog.getByLabel("District").selectOption("Sha Tin");
  await dialog.getByLabel("Building / estate / village").fill("Sunshine Court");
  await dialog.getByLabel("Weight (kg)").fill("65");
  await dialog.getByLabel("Height (cm)").fill("165");
  await dialog.getByLabel("WhatsApp phone (8 digits)").fill("61234567");
  await dialog.locator('select[aria-label="Mobility"]').selectOption({ label: "Needs assistance" });
  await dialog.locator('select[aria-label="Someone at home during service"]').selectOption("Yes");
  await dialog.locator(".guided-service-row").filter({ hasText: "Vital signs monitoring" }).first().getByRole("checkbox").first().check();
  await dialog.getByLabel("Vital signs monitoring preferred times").fill("09:00");
  await dialog.getByLabel("Start time").fill("09:00");
  await dialog.getByLabel("End time").fill("11:00");
  await dialog.getByRole("checkbox", { name: /fictional information/ }).check();
  await dialog.getByRole("button", { name: "Organise enquiry" }).click();

  await expect(dialog).toContainText("HK$1,220");
  await expect(dialog).toContainText("Materials and tools are supplied by the client");
  await dialog.getByRole("button", { name: "Submit my care enquiry" }).click();
  await expect(page.locator(".patient-request-person")).toContainText("Chan");
  await page.getByRole("button", { name: "Explore the staff demo" }).click();
  await page.getByLabel("Search workspace").fill("Chan");
  await page.locator(".search-results").getByRole("button", { name: /Chan.*HK-0025/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Vital signs monitoring");
  await expect(page.getByRole("dialog")).toContainText("HK$1,220");
});
