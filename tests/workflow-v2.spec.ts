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

test("staff settings expose real connections and contain no mock payment controls", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.goto("/#staff/settings");
  await expect(
    page.getByRole("heading", { name: "Connections and audit trail" }),
  ).toBeVisible();
  await expect(
    page.getByText("Service settings", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mock-sandbox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /mock|simulate|reset demo/i }),
  ).toHaveCount(0);
});
