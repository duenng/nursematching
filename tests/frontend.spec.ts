import { test, expect } from "@playwright/test";

test("all workspace sections render and global search opens the matching record", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#staff");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Alex");
  for (const name of [
    "Care enquiries",
    "Care requests",
    "Care schedule",
    "Care providers",
    "Messages",
    "Client records",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      name === "Messages" ? "Care messages" : name,
    );
  }
  await page.getByLabel("Search workspace").fill("HK-0024");
  await page.locator(".search-results").getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText("Mrs. Wong");
  await expect(page.getByRole("dialog")).toContainText("HK-0024");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Cantonese enquiry preserves unknown fields, accepts corrections, and persists", async ({
  page,
}) => {
  await page.goto("/#staff");
  await page.getByRole("button", { name: "New enquiry", exact: true }).click();
  await page.getByRole("button", { name: "Try a Cantonese example" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Organise enquiry" }).click();
  await expect(page.getByLabel("Patient age")).toHaveValue("78");
  await expect(page.getByLabel("Enquiry service district")).toHaveValue(
    "Sha Tin",
  );
  await expect(page.getByLabel("Care requested")).toHaveValue(
    "Wound care, Blood glucose monitoring",
  );
  await expect(page.getByLabel("Service duration")).toHaveValue("");
  await expect(page.getByLabel("Preferred time")).toHaveValue(
    "Afternoon · time to confirm",
  );
  await page.getByLabel("Patient name / alias").fill("Demo Wong");
  await page
    .getByLabel("Follow-up information")
    .fill("Need the service for 2 weeks.");
  await page.getByRole("button", { name: "Add follow-up details" }).click();
  await expect(page.getByLabel("Service duration")).toHaveValue("2 weeks");
  await page.getByRole("button", { name: "Save & review enquiry" }).click();
  await expect(page.getByRole("dialog")).toContainText("Demo Wong");
  await expect(
    page.getByRole("button", { name: "確認並發布 Case" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByLabel("Search workspace").fill("Demo Wong");
  await page.locator(".search-results").getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText("Demo Wong");
  await page.locator(".original-message summary").click();
  await expect(page.locator(".original-message")).toContainText("我媽媽78歲");
});

test("case publishing requires review and creates an anonymised simulated message", async ({
  page,
}) => {
  await page.goto("/#staff");
  await page.getByRole("button", { name: "Open HK-0024", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "確認並發布 Case" }),
  ).toBeDisabled();
  await dialog
    .getByRole("checkbox", {
      name: "Professional scope and care requirements reviewed by qualified staff",
    })
    .check();
  await dialog
    .getByRole("checkbox", { name: "Company approval to publish this case" })
    .check();
  await dialog.getByRole("button", { name: "確認並發布 Case" }).click();
  await expect(dialog.locator(".case-meta-bar")).toContainText(
    "Awaiting providers",
  );
  const broadcast = await dialog.locator(".broadcast-preview pre").innerText();
  expect(broadcast).toContain("HK-0024");
  expect(broadcast).toContain("Sha Tin");
  expect(broadcast).not.toContain("Mrs. Wong");
  expect(broadcast).not.toContain("Diabetes");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Messages", exact: true })
    .click();
  await expect(page.locator(".message-card")).toContainText("Simulated");
  await expect(page.locator(".message-bubble")).toContainText("HK-0024");
});

test("providers apply voluntarily and staff must confirm an eligible assignment", async ({
  page,
}) => {
  await page.goto("/#staff");
  await page.getByRole("button", { name: "Open HK-0023", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Provider applications" }).click();
  await expect(dialog.locator(".application-list")).toContainText(
    "Daniel Wong",
  );
  await dialog.getByLabel("Applying provider").selectOption("P-004");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Submit demo application" }).click();
  await expect(dialog.getByRole("alert")).toContainText("does not meet");
  await dialog.getByLabel("Applying provider").selectOption("P-001");
  await dialog.getByRole("button", { name: "Submit demo application" }).click();
  await expect(dialog.locator(".application-list>div")).toHaveCount(2);
  await expect(dialog.locator(".assigned-provider")).toHaveCount(0);
  await dialog
    .locator(".application-list>div")
    .filter({ hasText: "Daniel Wong" })
    .getByRole("button", { name: "Confirm assignment" })
    .click();
  await expect(dialog.locator(".assigned-provider")).toContainText(
    "Daniel Wong",
  );
  await expect(dialog.locator(".case-meta-bar")).toContainText(
    "Provider confirmed",
  );
});

test("schedule revision detects conflicts and resets approval; reminder does not mark completion", async ({
  page,
}) => {
  await page.goto("/#staff");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Care schedule", exact: true })
    .click();
  await page.getByRole("button", { name: "List view" }).click();
  await page
    .locator(".schedule-list-item")
    .filter({ hasText: "Mrs. Lee" })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Simulate visit reminder" }).click();
  await expect(dialog.locator(".visit-modal-status .badge")).toHaveText(
    "Confirmed",
  );
  await expect(dialog).toContainText("Simulated delivery");
  await dialog.getByRole("button", { name: "Record completion" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "explicit confirmation",
  );
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Record completion" }).click();
  await expect(dialog.locator(".visit-modal-status .badge")).toHaveText(
    "Completed",
  );
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .locator(".schedule-list-item")
    .filter({ hasText: "Mrs. Lee" })
    .nth(1)
    .click();
  await dialog.getByRole("button", { name: "Revise", exact: true }).click();
  await dialog.getByLabel("Revised start time").fill("13:00");
  await dialog.getByRole("button", { name: "Save revision" }).click();
  await expect(dialog.locator(".visit-modal-status .badge")).toHaveText(
    "Proposed",
  );
  await expect(dialog.locator(".revision-diff")).toContainText("11:00");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Approve schedule" }).click();
  await expect(dialog.locator(".visit-modal-status .badge")).toHaveText(
    "Confirmed",
  );
  await expect(dialog).toContainText("SCHEDULE VERSION 2");
});

test("schedule generator needs explicit instructions and rejects overlapping visits", async ({
  page,
}) => {
  await page.goto("/#staff");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Care schedule", exact: true })
    .click();
  await page.getByRole("button", { name: "Propose a schedule" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Schedule client").selectOption("HK-0023");
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + 7);
  const date = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  await dialog.getByLabel("First service date").fill(date);
  await dialog.getByLabel("Last service date").fill(date);
  await dialog.getByLabel("Visit start time").fill("09:00");
  await dialog.getByLabel("Visit duration").selectOption("60");
  await dialog.getByRole("button", { name: "Generate proposal" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "approved requirements",
  );
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Generate proposal" }).click();
  await expect(dialog.locator("tbody tr")).toHaveCount(1);
  await expect(dialog).toContainText("Pending approval");
  await dialog.getByRole("button", { name: "Save proposed schedule" }).click();
  await expect(page.getByRole("dialog")).toContainText("Mr. Chan");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.getByRole("button", { name: "Propose a schedule" }).click();
  await dialog.getByLabel("Schedule client").selectOption("HK-0023");
  await dialog.getByLabel("First service date").fill(date);
  await dialog.getByLabel("Last service date").fill(date);
  await dialog.getByLabel("Visit start time").fill("09:30");
  await dialog.getByLabel("Visit duration").selectOption("60");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Generate proposal" }).click();
  await expect(dialog.getByRole("alert")).toContainText("overlapping visit");
});

test("mobile workspace has usable navigation and no horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#staff");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/kindred-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Care schedule", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Care schedule",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Propose a schedule" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Search workspace").fill("HK-0024");
  await page.locator(".search-results").getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText("Mrs. Wong");
});
