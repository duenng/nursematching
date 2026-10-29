import { test, expect } from "@playwright/test";

test("public server form displays service pricing and requires real enquiry details", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.goto("/#patient");
  await page.getByRole("button", { name: "Enquire now", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pricing and arrangements" }),
  ).toBeVisible();
  await expect(page.getByText(/HK\$305\/hour/)).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm details and submit", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", {
      name: /I agree that this information may be stored/,
    }),
  ).not.toBeChecked();
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
