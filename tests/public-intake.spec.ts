import { test, expect } from "@playwright/test";

test("family sees submission progress and errors inside review, then submits without staff login", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  let staffReads = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/workflow")) staffReads++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Enquire now", exact: true }).click();
  await expect(page).toHaveURL(/#enquire$/);
  await expect(
    page.getByRole("heading", { name: "Home nursing enquiry" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Test inbox/ })).toHaveCount(0);
  await expect(page.getByLabel("Admin key")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Use enquiry form", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Confirm details and submit", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "Patient reference (package owner)",
  );
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("alert")).toBeInViewport();
  await page
    .getByRole("button", { name: "Go to the field to correct" })
    .click();
  await expect(
    page.getByLabel("Patient reference (package owner)"),
  ).toBeFocused();
  await page.getByLabel("Email (required)").fill("family@example.test");
  await page.getByLabel("Surname").fill("Li");
  await page.getByLabel("Building (no unit at intake)").fill("Test Building");
  await page.getByRole("combobox", { name: /^Gender/ }).selectOption("M");
  await page.getByRole("spinbutton", { name: "Age" }).fill("78");
  await page.getByRole("spinbutton", { name: "Weight kg" }).fill("65");
  await page.getByRole("spinbutton", { name: "Height cm" }).fill("165");
  await page.getByRole("combobox", { name: /^District/ }).selectOption("屯門");
  await page.getByLabel("Mobility").selectOption({ index: 1 });
  await page.getByLabel("Companion during service").selectOption({ index: 1 });
  await page
    .getByLabel("Patient reference (package owner)")
    .fill("PUBLIC-TEST-1");
  await page
    .getByLabel("Service date")
    .fill(new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10));
  await page
    .getByRole("checkbox", {
      name: /I agree that this information may be stored/,
    })
    .check();
  await page.getByLabel("Phone (optional, 8 digits)").fill("+852 1234 5678");
  await page
    .getByRole("button", { name: "Confirm details and submit", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "Enter 8 digits or leave this blank.",
  );
  await page
    .getByRole("button", { name: "Go to the field to correct" })
    .click();
  await expect(page.getByLabel("Phone (optional, 8 digits)")).toBeFocused();
  await page.getByLabel("Phone (optional, 8 digits)").fill("");
  await page
    .getByRole("button", { name: "Confirm details and submit", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route("**/api/enquiries", async (route) => {
    attempts++;
    if (attempts === 1) {
      await pending;
      return route.fulfill({
        status: 400,
        json: { error: "Please correct the service date." },
      });
    }
    if (attempts === 2)
      return route.fulfill({
        status: 502,
        contentType: "text/plain",
        body: "error code: 502",
      });
    if (attempts === 3) return route.abort("failed");
    return route.continue();
  });
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Confirm enquiry submission", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Submitting your enquiry, please wait…",
  );
  await expect(
    dialog.getByRole("button", { name: "Submitting…", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Back to edit", exact: true }),
  ).toBeDisabled();
  release();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Please correct the service date.",
  );
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByRole("alert")).toBeInViewport();
  await dialog
    .getByRole("button", { name: "Confirm enquiry submission", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "The server could not confirm the result.",
  );
  await dialog
    .getByRole("button", { name: "Confirm enquiry submission", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Could not reach the server or confirm the result.",
  );
  await expect(dialog).toContainText("family@example.test");
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
