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

test("patient approval and change requests flow through staff revision and patient reapproval", async ({
  page,
}) => {
  await page.goto("/#patient/care");
  await page.getByRole("button", { name: "Review a proposed visit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Approve this visit" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Please confirm");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Approve this visit" }).click();
  await expect(dialog.locator(".patient-dialog-status .badge")).toHaveText(
    "Confirmed",
  );
  await expect(
    dialog.getByRole("button", { name: "Record completion" }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Request a different time" })
    .click();
  await dialog.getByLabel("Preferred time (HKT)").fill("14:00");
  await dialog
    .getByLabel("Anything the team should know?")
    .fill("I have an appointment in the morning.");
  await dialog.getByRole("button", { name: "Send change request" }).click();
  await expect(dialog.locator(".patient-dialog-date")).toContainText("09:00");
  await expect(dialog.locator(".patient-pending-change")).toContainText(
    "14:00",
  );
  await expect(dialog.locator(".patient-dialog-status .badge")).toHaveText(
    "Confirmed",
  );
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Explore the staff demo" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Care schedule", exact: true })
    .click();
  await page.getByRole("button", { name: "List view" }).click();
  await page
    .locator(".schedule-list-item")
    .filter({ hasText: "Mr. Chan" })
    .first()
    .click();
  await expect(dialog.locator(".patient-pending-change")).toContainText(
    "Patient requested another time",
  );
  await dialog
    .getByRole("button", { name: "Prepare revised proposal" })
    .click();
  await expect(dialog.getByLabel("Revised start time")).toHaveValue("14:00");
  await dialog.getByRole("button", { name: "Save revision" }).click();
  await expect(dialog.locator(".visit-modal-status .badge")).toHaveText(
    "Proposed",
  );
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Patient view", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Patient navigation" })
    .getByRole("button", { name: "My care" })
    .click();
  await page.locator(".patient-visit-row").first().click();
  await expect(dialog.locator(".patient-dialog-date")).toContainText("14:00");
  await expect(dialog.locator(".patient-dialog-status")).toContainText(
    "Version 2",
  );
  await expect(dialog.locator(".patient-pending-change")).toHaveCount(0);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Approve this visit" }).click();
  await expect(dialog.locator(".patient-dialog-status .badge")).toHaveText(
    "Confirmed",
  );
});

test("patient corrections require fresh care-team review and questions reach the demo activity log", async ({
  page,
}) => {
  await page.goto("/#patient/care");
  await page
    .getByRole("button", { name: "Review or correct my details" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Preferred visit time").fill("Afternoon");
  await dialog.getByRole("button", { name: "Save my corrections" }).click();
  await expect(page.locator(".patient-request-status")).toContainText(
    "Your request is being reviewed",
  );
  await page.getByRole("button", { name: "Review a proposed visit" }).click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Approve this visit" }).click();
  await expect(dialog.getByRole("alert")).toContainText("finish reviewing");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Ask a question" }).click();
  await dialog
    .getByLabel("Your question")
    .fill("Can my family member attend the visit?");
  await dialog.getByRole("button", { name: "Save my question" }).click();
  await expect(dialog).toContainText("no message has been sent");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Explore the staff demo" }).click();
  await expect(page.locator(".activity-list")).toContainText(
    "Patient has a question",
  );
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
