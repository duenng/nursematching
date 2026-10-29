import { test, expect } from "@playwright/test";

const session = (role: string) => ({
  mode: "google",
  login_url: "/auth/google",
  user: {
    id: `STAFF-${role}`,
    email: `${role.toLowerCase()}@example.test`,
    role,
    method: "google",
    csrf: "test-browser-csrf",
  },
});
async function openWorkspace(page: import("@playwright/test").Page) {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.goto("/#staff/email");
}

test("logged-out Google mode shows staff sign-in and does not fetch workflow data", async ({
  page,
}) => {
  let workflowReads = 0;
  await page.route("**/auth/session", (route) =>
    route.fulfill({
      json: { mode: "google", user: null, login_url: "/auth/google" },
    }),
  );
  await page.route("**/api/workflow", (route) => {
    workflowReads++;
    return route.fulfill({ status: 401, json: { error: "Sign in required" } });
  });
  await openWorkspace(page);
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in with Google" }),
  ).toHaveAttribute("href", "/auth/google");
  await expect(page.getByLabel("Admin key")).toHaveCount(0);
  expect(workflowReads).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("senior nurse worklist supports draft, edit, review and logout without finance or family links", async ({
  page,
}, testInfo) => {
  let signedIn = true;
  let c = {
    id: "C-CLINICAL-1",
    status: "MATCHED",
    patient_ref: "TEST-1",
    age: 78,
    gender: "M",
    date: "2026-11-10",
    start: "10:00",
    end: "14:00",
    schedule_status: "PENDING_REVIEW",
    medical_history: "虛構病史",
    doctor_document: {
      id: "DOC-FIXTURE",
      sha256: "a".repeat(64),
      size: 100,
      uploaded_at: "2026-10-29T04:00:00Z",
    },
    services: [{ label: "生命表徵", times: ["12:00"], prn: false }],
  } as Record<string, unknown>;
  await page.route("**/auth/session", (route) =>
    route.fulfill({
      json: signedIn
        ? session("SENIOR_NURSE")
        : { mode: "google", user: null, login_url: "/auth/google" },
    }),
  );
  await page.route("**/api/workflow", (route) =>
    route.fulfill({ json: { cases: [c] } }),
  );
  await page.route("**/api/case-action", async (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe("test-browser-csrf");
    const input = route.request().postDataJSON();
    if (input.action === "draft")
      c = { ...c, schedule: [{ time: "12:00", item: "生命表徵" }] };
    if (input.action === "schedule_edit") {
      expect(input.reason).toBe("家屬更正時間");
      c = { ...c, schedule: input.schedule, schedule_status: "PENDING_REVIEW" };
    }
    if (input.action === "nurse") {
      expect(input.document_id).toBe("DOC-FIXTURE");
      expect(input.document_verified).toBe(true);
    }
    if (input.action === "nurse")
      c = {
        ...c,
        schedule_status: "NURSE_REVIEWED",
        reviewed_by: "STAFF-SENIOR_NURSE",
      };
    return route.fulfill({ json: c });
  });
  await page.route("**/auth/logout", (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe("test-browser-csrf");
    signedIn = false;
    return route.fulfill({ json: { ok: true } });
  });
  await openWorkspace(page);
  await expect(
    page.getByRole("heading", { name: "Care schedule review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Confirm FPS receipt after reconciliation",
    }),
  ).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Test inbox/ })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Generate rules draft", exact: true })
    .click();
  await page
    .getByText("Edit schedule (requires reapproval)", { exact: true })
    .click();
  await page.getByRole("button", { name: "Load draft", exact: true }).click();
  await page
    .getByLabel("Schedule JSON")
    .fill(JSON.stringify([{ time: "13:00", item: "生命表徵" }]));
  await page.getByLabel("Review / edit reason").fill("家屬更正時間");
  await page.getByRole("button", { name: "Record edit", exact: true }).click();
  await expect(page.locator("pre").last()).toContainText("13:00");
  await expect(
    page.getByRole("link", { name: "Download doctor-order document" }),
  ).toHaveAttribute("href", "/api/doctor-document/DOC-FIXTURE");
  await page
    .getByRole("checkbox", {
      name: "I reviewed this document version and verified the doctor order",
    })
    .check();
  await page
    .getByRole("button", { name: "Confirm senior nurse review", exact: true })
    .click();
  await expect(page.locator(".ev-state")).toContainText("NURSE_REVIEWED");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .locator(".sidebar")
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await page.screenshot({
    path: testInfo.outputPath("senior-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await expect(page.getByText("虛構病史", { exact: false })).toHaveCount(0);
});
