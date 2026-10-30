import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
});

test("description-first enquiry retains both modes and submits original text without AI", async ({
  page,
}) => {
  await page.goto("/#enquire");
  await expect(
    page.getByRole("heading", {
      name: "Tell us about the patient in your own words",
    }),
  ).toBeVisible();
  const description = page.getByLabel("Patient situation", { exact: true });
  await description.fill(
    "Mum has just left hospital and needs help at home. Timing is not confirmed.",
  );
  await page
    .getByRole("button", { name: "Use enquiry form", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Submit a care enquiry" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Describe with AI", exact: true })
    .click();
  await expect(description).toHaveValue(/Mum has just left hospital/);
  await page
    .getByRole("button", { name: "Review and add contact details" })
    .click();
  await page.getByLabel("Contact name", { exact: true }).fill("Li");
  await page
    .getByLabel("Email (required)", { exact: true })
    .filter({ visible: true })
    .fill("conversation@example.test");
  await page
    .getByRole("checkbox", {
      name: "I have reviewed the patient description and enquiry details above.",
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: /I agree that this information may be stored/,
    })
    .check();
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/enquiries/conversation"),
  );
  await page
    .getByRole("button", { name: "Confirm enquiry submission", exact: true })
    .click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole("status")).toContainText("Enquiry received");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("AI asks follow-ups, corrections replace summaries, and failures retain the description", async ({
  page,
}, testInfo) => {
  let requests = 0;
  await page.route("**/api/enquiries/assistant-config", (route) =>
    route.fulfill({
      json: { provider: "openrouter", enabled: true },
    }),
  );
  await page.route("**/api/enquiries/assistant", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.consent).toBe(true);
    expect(
      body.messages.every((m: { role: string }) =>
        ["user", "assistant"].includes(m.role),
      ),
    ).toBeTruthy();
    requests++;
    if (requests === 3)
      return route.fulfill({
        status: 503,
        json: { error: "AI is unavailable. Submit your description directly." },
      });
    return route.fulfill({
      json: {
        reply: "Which district and when would you like support?",
        summary:
          requests === 1
            ? "Mum needs walking support."
            : "Mum needs support in Sha Tin next week.",
        care_needs: "Walking support",
        age: "78",
        mobility: "Needs help walking",
        district: requests === 1 ? "" : "Sha Tin",
        preferred_timing: requests === 1 ? "" : "Next week",
        service_ids: ["mobility"],
      },
    });
  });
  await page.goto("/#enquire");
  await page
    .getByLabel("Patient situation", { exact: true })
    .fill("Mum is 78 and needs help walking.");
  await expect(
    page.getByRole("button", { name: "Organise with AI", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: /I agree to send my description to OpenRouter and its model provider/,
    })
    .check();
  await page
    .getByRole("button", { name: "Organise with AI", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Summary to confirm" }),
  ).toContainText("To confirm");
  await page
    .getByLabel("Add details or correct the patient's situation")
    .fill("Sha Tin, next week.");
  await page
    .getByRole("button", { name: "Organise with AI", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Summary to confirm" }),
  ).toContainText("Sha Tin");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("ai-enquiry-mobile.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Add details or correct the patient's situation")
    .fill("Actually, Tai Po.");
  await page
    .getByRole("button", { name: "Organise with AI", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("AI is unavailable");
  await expect(page.getByRole("log")).toContainText("Actually, Tai Po.");
  await expect(
    page.getByRole("region", { name: "Summary to confirm" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Review and add contact details" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your care enquiry" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "繁中", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "核對你的護理查詢" }),
  ).toBeVisible();
});
