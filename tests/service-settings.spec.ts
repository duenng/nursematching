import { test, expect } from "@playwright/test";

test("active-case settings save email without rates, then accept initial rates and show failures", async ({
  page,
}) => {
  const workspace = await (await page.request.get("/api/workflow")).json();
  let state = {
    ...workspace,
    settings_locked: true,
    admin_email: "",
    settings: {
      ...workspace.settings,
      nurse_day_rate: null,
      nurse_night_rate: null,
    },
    cases: [],
  };
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.route("**/api/workflow", (route) =>
    route.fulfill({ json: state }),
  );
  await page.route("**/api/settings", async (route) => {
    const input = route.request().postDataJSON();
    if (input.admin_email === "invalid") {
      await route.fulfill({
        status: 400,
        json: { error: "請提供有效管理員電郵" },
      });
      return;
    }
    state = {
      ...state,
      admin_email: input.admin_email.trim().toLowerCase(),
      settings: {
        ...state.settings,
        nurse_day_rate: input.nurse_day_rate
          ? Number(input.nurse_day_rate)
          : null,
        nurse_night_rate: input.nurse_night_rate
          ? Number(input.nurse_night_rate)
          : null,
      },
    };
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/#staff/settings");
  const settings = page.locator(".ev-config");
  await expect(settings.getByLabel("Time scale")).toBeDisabled();
  await expect(settings.getByLabel("Day nurse rate HKD")).toBeEnabled();
  await settings.getByLabel("Admin email").fill("Admin@careknock.invalid");
  await settings.getByRole("button", { name: "Save service settings" }).click();
  await expect(settings.getByRole("status")).toContainText("Settings saved.");
  await expect(
    settings.getByText(/Admin notification email is not configured/),
  ).toHaveCount(0);
  await expect(settings.getByLabel("Admin email")).toHaveValue(
    "admin@careknock.invalid",
  );
  await settings.getByLabel("Day nurse rate HKD").fill("245");
  await settings.getByLabel("Night nurse rate HKD").fill("270");
  await settings.getByRole("button", { name: "Save service settings" }).click();
  await expect(settings.getByLabel("Day nurse rate HKD")).toBeDisabled();
  await expect(settings.getByLabel("Night nurse rate HKD")).toBeDisabled();
  await page.reload();
  await expect(settings.getByLabel("Admin email")).toHaveValue(
    "admin@careknock.invalid",
  );
  await expect(settings.getByLabel("Day nurse rate HKD")).toHaveValue("245");
  await settings.getByLabel("Admin email").fill("invalid");
  await settings.getByRole("button", { name: "Save service settings" }).click();
  await expect(settings.getByRole("alert")).toHaveText("請提供有效管理員電郵");
});
