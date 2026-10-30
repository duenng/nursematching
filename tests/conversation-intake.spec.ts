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

test("connection failures keep the original description, allow AI retry and direct submission", async ({
  page,
}) => {
  const description = "my dad need to be taken care he is 79 years old";
  await page.route("**/api/enquiries/assistant-config", (route) =>
    route.fulfill({ json: { provider: "openrouter", enabled: true } }),
  );
  let attempts = 0;
  await page.route("**/api/enquiries/assistant", (route) => {
    const body = route.request().postDataJSON();
    expect(body.messages).toEqual([{ role: "user", content: description }]);
    attempts++;
    return attempts === 1
      ? route.abort("failed")
      : route.fulfill({ status: 502, body: "<html>Bad gateway</html>" });
  });
  await page.goto("/#enquire");
  await page.getByLabel("Patient situation", { exact: true }).fill(description);
  await page
    .getByRole("checkbox", { name: /I agree to send my description/ })
    .check();
  const organise = page.getByRole("button", {
    name: "Organise with AI",
    exact: true,
  });
  await organise.click();
  await expect(page.getByRole("alert")).toContainText(
    "We could not connect to the service",
  );
  await expect(page.getByRole("log")).toContainText(description);
  await expect(organise).toBeEnabled();
  await organise.click();
  await expect(page.getByRole("alert")).toContainText(
    "We could not read the service response",
  );
  await expect(page.locator(".conversation-message.user")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Review and add contact details" })
    .click();
  await page.getByLabel("Contact name", { exact: true }).fill("Test family");
  await page
    .getByLabel("Email (required)", { exact: true })
    .filter({ visible: true })
    .fill("network-retry@example.test");
  await page
    .getByRole("checkbox", { name: /I have reviewed the patient description/ })
    .check();
  await page
    .getByRole("checkbox", {
      name: /I agree that this information may be stored/,
    })
    .check();
  await page.route("**/api/enquiries/conversation", (route) =>
    route.abort("failed"),
  );
  const submit = page.getByRole("button", {
    name: "Confirm enquiry submission",
    exact: true,
  });
  await submit.click();
  await expect(page.getByRole("alert")).toContainText(
    "Your details are still here",
  );
  await expect(page.getByLabel("Contact name", { exact: true })).toHaveValue(
    "Test family",
  );
  await expect(
    page.getByRole("heading", { name: /Enquiry received/ }),
  ).toHaveCount(0);
  await page.unroute("**/api/enquiries/conversation");
  await submit.click();
  await expect(page.getByRole("status")).toContainText("Enquiry received");
});

test("AI configuration failures can be retried without losing the description", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "zh-HK"),
  );
  let attempts = 0;
  await page.route("**/api/enquiries/assistant-config", (route) => {
    attempts++;
    return attempts === 1
      ? route.abort("failed")
      : route.fulfill({ json: { provider: "openrouter", enabled: true } });
  });
  await page.goto("/#enquire");
  const description = page.getByLabel("病人狀況描述", { exact: true });
  await description.fill("my dad need to be taken care he is 79 years old");
  await expect(page.getByRole("status")).toContainText("暫時未能連接 AI 服務");
  await expect(
    page.getByRole("button", { name: "請 AI 幫我整理", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "核對並留下聯絡方式" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "重試 AI 連線" }).click();
  await page
    .getByRole("checkbox", { name: /我同意將描述交由 OpenRouter/ })
    .check();
  await expect(
    page.getByRole("button", { name: "請 AI 幫我整理", exact: true }),
  ).toBeEnabled();
  await expect(description).toHaveValue(
    "my dad need to be taken care he is 79 years old",
  );
});

test("disabled AI explains direct submission and prevents provider requests", async ({
  page,
}) => {
  await page.route("**/api/enquiries/assistant-config", (route) =>
    route.fulfill({ json: { provider: "openrouter", enabled: false } }),
  );
  await page.goto("/#enquire");
  await expect(page.getByRole("status")).toContainText(
    "AI is currently unavailable",
  );
  await page
    .getByLabel("Patient situation", { exact: true })
    .fill("Dad is 79.");
  await expect(
    page.getByRole("checkbox", { name: /I agree to send my description/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Organise with AI", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Review and add contact details" })
    .click();
  await expect(page.getByRole("log")).toContainText("Dad is 79.");
  await expect(
    page.getByRole("heading", { name: "Review your care enquiry" }),
  ).toBeVisible();
});
