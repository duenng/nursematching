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

test("patient enquiry opens My care for the new patient and persists without client directory access", async ({
  page,
}) => {
  await page.goto("/#patient");
  await page.getByRole("button", { name: "Enquire now", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("How can we help?")
    .fill(
      "I am 70 years old and live in Sha Tin. I need an appointment companion on Monday morning for 2 weeks.",
    );
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Organise enquiry" }).click();
  await expect(dialog.getByLabel("Existing client")).toHaveCount(0);
  await dialog.getByLabel("Patient name / alias").fill("Demo Patient");
  await dialog.getByRole("button", { name: "Submit my care enquiry" }).click();
  await expect(page).toHaveURL(/#patient\/care$/);
  await expect(page.locator(".patient-request-person")).toContainText(
    "Demo Patient",
  );
  await expect(page.locator("main")).not.toContainText("Mr. Chan");
  await expect(page.locator(".patient-visits-card")).toContainText(
    "Your schedule will appear here",
  );
  await page.reload();
  await expect(page.locator(".patient-request-person")).toContainText(
    "Demo Patient",
  );
  await page.getByRole("button", { name: "Explore the staff demo" }).click();
  await page.getByLabel("Search workspace").fill("Demo Patient");
  await page.locator(".search-results").getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Appointment accompaniment",
  );
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
