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

test("staff entry moves to the session origin before requiring a third-party cookie", async ({
  page,
}, testInfo) => {
  const backend = new URL(String(testInfo.project.use.baseURL));
  backend.hostname = "127.0.0.1";
  let publicWorkflowReads = 0;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/auth/session", (route) => {
    const onBackend = new URL(route.request().url()).origin === backend.origin;
    return route.fulfill({
      json: {
        ...(onBackend
          ? session("ADMIN")
          : { mode: "google", user: null, login_url: "/auth/google" }),
        staff_url: `${backend.origin}/#staff`,
      },
    });
  });
  await page.route("**/api/workflow", (route) => {
    if (new URL(route.request().url()).origin !== backend.origin)
      publicWorkflowReads++;
    return route.fulfill({ status: 503, json: { error: "Test workspace" } });
  });
  await page.goto("/#staff/requests");
  await expect(page).toHaveURL(`${backend.origin}/#staff/requests`);
  await expect(page.locator(".sidebar")).toBeAttached();
  expect(publicWorkflowReads).toBe(0);
});

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
  await expect(page.locator(".sidebar, .topbar, .content-footer")).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Search workspace")).toHaveCount(0);
  await expect(page.getByText("Mr. Chan", { exact: true })).toHaveCount(0);
  expect(workflowReads).toBe(0);
  for (const hash of ["#staff", "#staff/requests", "#staff/email"]) {
    await page.goto("/" + hash);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Staff sign in" }),
    ).toBeVisible();
    await expect(page.locator(".sidebar, .topbar")).toHaveCount(0);
  }
  expect(workflowReads).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("staff shell stays unmounted while checking access and after a session failure", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/auth/session", async (route) => {
    await pending;
    await route.fulfill({ status: 503, json: { error: "Unavailable" } });
  });
  await page.goto("/#staff");
  await expect(page.getByRole("status")).toContainText("Checking staff access");
  await expect(page.locator(".sidebar, .topbar")).toHaveCount(0);
  release();
  await expect(page.getByRole("alert")).toContainText(
    "Cannot verify staff session",
  );
  await expect(page.locator(".sidebar, .topbar")).toHaveCount(0);
});

test("a revoked session removes the entire staff shell on revalidation", async ({
  page,
}) => {
  let signedIn = true;
  await page.route("**/auth/session", (route) =>
    route.fulfill({
      json: signedIn
        ? session("ADMIN")
        : { mode: "google", user: null, login_url: "/auth/google" },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  await page.goto("/#staff");
  await expect(page.locator(".sidebar")).toBeVisible();
  signedIn = false;
  await page.evaluate(() =>
    window.dispatchEvent(new Event("staff-session-expired")),
  );
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await expect(page.locator(".sidebar, .topbar")).toHaveCount(0);
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
      expect(input.schedule).toEqual([{ time: "13:00", item: "生命表徵" }]);
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
  await page.getByLabel("Time 1", { exact: true }).fill("13:00");
  await page
    .getByRole("checkbox", { name: "Nurse to arrange", exact: true })
    .check();
  await expect(page.getByLabel("Time 1", { exact: true })).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Nurse to arrange", exact: true })
    .uncheck();
  await page.getByLabel("Time 1", { exact: true }).fill("13:00");
  await expect(page.getByLabel("Care task 1", { exact: true })).toHaveValue(
    "生命表徵",
  );
  await page.getByLabel("Review / edit reason").fill("家屬更正時間");
  await page.getByRole("button", { name: "Record edit", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Care schedule", exact: true }),
  ).toContainText("13:00");
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
  await expect(page.locator(".ev-state")).toContainText("Nurse reviewed");
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
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await expect(page.getByText("虛構病史", { exact: false })).toHaveCount(0);
  await expect(page.locator(".sidebar, .topbar, .content-footer")).toHaveCount(
    0,
  );
});

test("clinical summary handles missing patient details and a confirmed non-doctor service without raw JSON", async ({
  page,
}, testInfo) => {
  await page.route("**/auth/session", (route) =>
    route.fulfill({ json: session("SENIOR_NURSE") }),
  );
  await page.route("**/api/workflow", (route) =>
    route.fulfill({
      json: {
        cases: [
          {
            id: "C2026-0001",
            status: "READY",
            schedule_status: "CONFIRMED",
            date: "2026-12-01",
            start: "10:00",
            end: "14:00",
            doctor_order: "NA",
            services: [
              {
                id: "vitals",
                label: "檢測生命表徵",
                times: ["12:00"],
                prn: false,
              },
            ],
            schedule: [{ time: "12:00", item: "檢測生命表徵" }],
          },
        ],
      },
    }),
  );
  await openWorkspace(page);
  const summary = page.locator(".ev-clinical-case");
  await expect(summary.getByRole("heading", { level: 2 })).toHaveText(
    "C2026-0001",
  );
  await expect(summary.locator(".ev-state")).toContainText("Ready for service");
  await expect(summary.locator(".ev-state")).toContainText(
    "Schedule confirmed",
  );
  await expect(summary.locator("pre")).toHaveCount(0);
  await expect(summary).not.toContainText('"services"');
  await expect(summary).not.toContainText("Download the uploaded");
  await expect(summary).toContainText("Not applicable");
  await expect(summary.locator(".ev-clinical-facts")).toContainText(
    "10:00 – 14:00",
  );
  await page.getByRole("button", { name: "繁中", exact: true }).click();
  await expect(summary.locator(".ev-state")).toContainText("待服務");
  await expect(summary.locator(".ev-clinical-facts")).toContainText(
    "2026年12月1日",
  );
  await expect(summary.locator(".ev-clinical-facts")).toContainText("未提供");
  await page.screenshot({
    path: testInfo.outputPath("clinical-summary-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary.getByRole("heading", { level: 2 })).toBeVisible();
  await page
    .locator(".sidebar")
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("clinical-summary-mobile.png"),
    fullPage: true,
  });
});
