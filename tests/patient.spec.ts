import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
});

test("patients land on service pages and can explore their own care without staff controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little help at home",
  );
  await expect(
    page.getByRole("button", { name: "Open patient menu" }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Nursing care at home" }),
  ).toBeVisible();
  await page
    .getByText("Can I arrange care for myself?", { exact: true })
    .click();
  await expect(page.locator(".patient-faq-list details").first()).toContainText(
    "You can enquire for yourself",
  );
  await page
    .getByRole("navigation", { name: "Patient navigation" })
    .getByRole("button", { name: "My care" })
    .click();
  await expect(page.locator(".patient-request-person")).toContainText(
    "Mr. Chan",
  );
  await expect(page.locator("main")).not.toContainText("Mrs. Wong");
  await expect(
    page.getByRole("button", { name: "Confirm & publish case" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Search workspace")).toHaveCount(0);
  await expect(page.locator(".patient-visit-row")).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("homepage enquiry uses the server form without a browser-only consent claim", async ({
  page,
}) => {
  await page.goto("/#patient");
  await page.getByRole("button", { name: "Enquire now", exact: true }).click();
  await expect(page).toHaveURL(/#enquire$/);
  await expect(
    page.getByRole("heading", { name: "Home nursing enquiry" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use enquiry form", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: /I agree that this information may be stored/,
    }),
  ).toBeVisible();
  await expect(page.getByText(/All data is fictional/)).toHaveCount(0);
  await expect(page.getByLabel("Surname", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Email (required)")).toHaveValue("");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Home nursing enquiry" }),
  ).toBeVisible();
});

test("patient preview changes cannot create or modify real staff records", async ({
  page,
}) => {
  await page.goto("/#patient/care");
  await page
    .getByRole("button", { name: "Review or correct my details" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Preferred visit time").fill("PREVIEW-ONLY-CHANGE");
  await dialog.getByRole("button", { name: "Save my corrections" }).click();
  await page.goto("/#staff/requests");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Care requests",
  );
  await expect(page.locator("main")).not.toContainText("PREVIEW-ONLY-CHANGE");
  await expect(page.locator("main")).not.toContainText("Mr. Chan");
  const state = await (await page.request.get("/api/workflow")).json();
  expect(JSON.stringify(state.cases)).not.toContain("PREVIEW-ONLY-CHANGE");
});

test("mobile patients can browse services, open My care and request care without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/kindred-patient-mobile-home.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open patient menu" }).click();
  await page
    .getByRole("navigation", { name: "Patient navigation" })
    .getByRole("button", { name: "My care" })
    .click();
  await expect(page.locator(".patient-request-person")).toContainText(
    "Mr. Chan",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/kindred-patient-mobile-care.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Review a proposed visit" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
