import { test, expect } from "@playwright/test";

test("administrator can review a Sunday night quote and family sees the exact confirmed charges", async ({
  page,
  context,
  baseURL,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "zh-HK"),
  );
  const configured = await page.request.post("/api/settings", {
    data: {
      nurse_day_rate: 245,
      nurse_night_rate: 270,
      policies: { allow_arrival_completion: true },
    },
  });
  expect(configured.ok(), await configured.text()).toBeTruthy();
  const response = await page.request.post("/api/enquiries", {
    headers: {
      Origin: new URL(baseURL!).origin,
    },
    data: {
      surname: "Night quote test",
      patient_ref: "Night quote test",
      email: "night-quote@example.test",
      phone: "",
      district: "東區",
      building: "Test building",
      date: "2026-11-07",
      shift: "NIGHT12",
      start: "22:00",
      end: "10:00",
      consent: true,
      gender: "M",
      age: 79,
      weight_kg: 65,
      height_cm: 165,
      mobility: "需人輔助",
      companion: "YES",
      doctor_order: "NA",
      existing_tube: "YES",
      services: [{ id: "vitals", times: [], prn: true }],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const created = await response.json();
  await page.goto(`/#staff/requests/${created.id}`);
  await page.getByText("人工覆核／取消退款／重新招募", { exact: true }).click();
  const requirements = page.locator("#quote-requirements");
  const issue = page.getByRole("button", {
    name: "人工處理後發報價",
    exact: true,
  });
  await expect(issue).toBeDisabled();
  await expect(issue).toHaveAttribute("aria-describedby", "quote-requirements");
  await expect(requirements).toContainText("地點覆核尚未儲存");
  await expect(
    page.getByLabel("覆核／操作原因", { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("偏遠分類（只影響護士交通津貼）").selectOption("C");
  await expect(requirements).toHaveCount(0);
  await issue.click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "夜更涉及星期日／公眾假期，待確認" })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "使用人工確認的夜更收費", exact: true })
    .check();
  await expect(issue).toBeDisabled();
  await expect(requirements).toContainText("請填寫人工基本費及附加費");
  await expect(requirements).toContainText("請核對總額，並勾選");
  await page.getByLabel("人工基本費 HKD（整數）", { exact: true }).fill("3900");
  await page
    .getByLabel("人工附加費 HKD（無附加費請填 0）", { exact: true })
    .fill("600");
  await expect(
    page.getByText("人工報價總額: HK$4,500", { exact: true }),
  ).toBeVisible();
  const confirm = page.getByRole("checkbox", {
    name: /我已核實此夜更的基本費/,
  });
  await page.getByLabel("收費依據（至少 10 字）", { exact: true }).fill("核實");
  await confirm.check();
  await expect(issue).toBeDisabled();
  await expect(requirements).toContainText("至少 10 字收費依據");
  await page
    .getByLabel("收費依據（至少 10 字）", { exact: true })
    .fill("已核實本次跨星期日夜更收費及服務地址");
  await expect(issue).toBeEnabled();
  await expect(requirements).toHaveCount(0);
  await page
    .getByLabel("人工附加費 HKD（無附加費請填 0）", { exact: true })
    .fill("700");
  await expect(confirm).not.toBeChecked();
  await expect(issue).toBeDisabled();
  await expect(requirements).toContainText("修改金額後須重新勾選");
  await page
    .getByLabel("人工附加費 HKD（無附加費請填 0）", { exact: true })
    .fill("600");
  await confirm.check();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const sent = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/case-action") &&
      r.request().postDataJSON().action === "issue_quote",
  );
  await issue.click();
  expect((await sent).ok()).toBeTruthy();
  await expect(page.locator(".ev-state")).toContainText("已報價");
  await expect(
    page.getByText(
      "已建立報價並排入電郵傳送佇列。請到「電郵通知」查看寄送結果。",
      { exact: true },
    ),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/workflow")).json();
  const quote = snapshot.emails.find(
    (mail: { case_id: string; template_id: string }) =>
      mail.case_id === created.id && mail.template_id === "T1",
  );
  expect(quote.body).toContain("總額：HK$4500");
  const family = await context.newPage();
  await family.goto(
    quote.links.find(
      (link: { label: string }) => link.label === "accept_single",
    ).url,
  );
  await expect(family.locator("main")).toContainText("基本費 HK$3900");
  await expect(family.locator("main")).toContainText("附加費 HK$600");
  await expect(family.locator("main")).toContainText("翌日 10:00");
  await expect(family.locator("main")).toContainText("總額：HK$4500");
});

test("staff enquiry reaches server, quote confirmation, independent bank reconciliation and real nurse matching", async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("kindred-language", "en"),
  );
  const current = await (await page.request.get("/api/workflow")).json();
  const configured = await page.request.post("/api/settings", {
    data: {
      time_scale: 1,
      nurse_day_rate: 245,
      nurse_night_rate: 270,
      admin_email: "admin@careknock.invalid",
      nurses: current.nurses,
      policies: { allow_arrival_completion: true },
    },
  });
  expect(configured.ok()).toBeTruthy();
  const provider = await (
    await page.request.post("/api/nurses", {
      data: {
        name: "Workflow nurse",
        email: `workflow-${Date.now()}@careknock.invalid`,
        category: "RN",
        registration: "RN-TEST",
        verification_note: "Credentials verified for workflow test",
        credentials_verified: true,
        status: "VERIFIED",
      },
    })
  ).json();
  await page.goto("/#staff/enquiries");
  await page
    .getByLabel("Patient reference (package owner)")
    .fill("LIVE-BROWSER-TEST");
  await page
    .getByRole("combobox", { name: "Gender", exact: true })
    .selectOption("M");
  await page.getByLabel("Age", { exact: true }).fill("78");
  await page.getByLabel("Weight kg").fill("65");
  await page.getByLabel("Height cm").fill("165");
  await page
    .getByRole("combobox", { name: "Mobility", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "Companion during service", exact: true })
    .selectOption("YES");
  await page.getByLabel("Patient name", { exact: true }).fill("Li");
  await page.getByLabel("Email (required)").fill("family@careknock.invalid");
  await page
    .getByRole("combobox", { name: "District", exact: true })
    .selectOption("屯門");
  await page
    .getByLabel("Building (no unit at intake)")
    .fill("Workflow Building");
  await page.getByLabel("Service date", { exact: true }).fill("2026-11-10");
  await page.getByRole("checkbox", { name: /生命表徵/ }).check();
  await page
    .getByRole("checkbox", { name: /I agree that this information/ })
    .check();
  await page
    .getByRole("button", { name: "Confirm details and submit", exact: true })
    .click();
  const submitted = page.waitForResponse(
    (r) => r.url().endsWith("/api/cases") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Confirm enquiry submission", exact: true })
    .click();
  const response = await submitted;
  expect(response.ok()).toBeTruthy();
  const c = await response.json();
  expect(c.intake_mode).toBe("LIVE");
  expect(c.fictional).toBe(false);
  await expect(page).toHaveURL(new RegExp(`#staff/requests/${c.id}$`));
  await expect(page.locator(".ev-state")).toContainText("Needs review");
  await page
    .getByText("Manual review, cancellation, refunds and reposting", {
      exact: true,
    })
    .click();
  await page.getByLabel("Remote tier (nurse allowance only)").selectOption("C");
  await expect(page.getByTestId("saved-travel-allowance")).toContainText(
    "HK$0",
  );
  await page
    .getByRole("button", { name: "Issue quote after review", exact: true })
    .click();
  await expect(page.locator(".ev-state")).toContainText("Quote sent");
  let state = await (await page.request.get("/api/workflow")).json();
  const quote = state.emails.find(
    (m: { case_id: string; template_id: string }) =>
      m.case_id === c.id && m.template_id === "T1",
  );
  const link = quote.links.find(
    (l: { label: string }) => l.label === "accept_single",
  ).url;
  const family = await context.newPage();
  await family.goto(link);
  await expect(
    family.getByRole("button", { name: "確認：接受單次報價" }),
  ).toBeVisible();
  await expect(family.locator("main")).toContainText("基本費 HK$1220");
  await expect(family.locator("main")).toContainText("總額：HK$1220");
  expect(
    (await (await page.request.get("/api/workflow")).json()).cases.find(
      (x: { id: string }) => x.id === c.id,
    ).status,
  ).toBe("QUOTED");
  await family.getByRole("button", { name: "確認：接受單次報價" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Approve preview and dispatch" }),
  ).toBeHidden();
  state = await (await page.request.get("/api/workflow")).json();
  const payment = state.emails.find(
    (m: { case_id: string; template_id: string }) =>
      m.case_id === c.id && m.template_id === "T8",
  );
  const reportLink = payment.links.find(
    (l: { label: string }) => l.label === "report_fps",
  ).url;
  const rejected = await page.request.post(reportLink, {
    multipart: {
      screenshot: {
        name: "bad.png",
        mimeType: "image/png",
        buffer: Buffer.from("invalid image"),
      },
    },
  });
  expect(rejected.status()).toBe(400);
  expect(await rejected.text()).toContain("請重新上載付款截圖");
  await family.goto(reportLink);
  await expect(family.getByLabel("轉帳參考編號", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    family.locator('input[name="amount"], input[type="date"]'),
  ).toHaveCount(0);
  const screenshot = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII=",
    "base64",
  );
  await family.getByLabel("付款截圖", { exact: true }).setInputFiles({
    name: "payment.png",
    mimeType: "image/png",
    buffer: screenshot,
  });
  await family.setViewportSize({ width: 390, height: 844 });
  expect(
    await family.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await family
    .getByRole("button", {
      name: "確認：提交付款截圖（待同事核實）",
      exact: true,
    })
    .click();
  await expect(family.locator("main")).toContainText(
    "已收到付款截圖，等候同事核實",
  );
  const reportedState = await (await page.request.get("/api/workflow")).json();
  expect(
    reportedState.cases.find((item: { id: string }) => item.id === c.id).status,
  ).toBe("PENDING_PAY");
  await page.reload();
  await page
    .getByRole("combobox", { name: "Pending transfer report", exact: true })
    .selectOption({ index: 1 });
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: /Download payment screenshot/ })
    .click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /^payment-.*\.png$/,
  );
  await page
    .getByLabel("Bank receipt / refund reference")
    .fill(`BANK-${Date.now()}`);
  await page.getByLabel("Verified amount HKD").fill("1220");
  const hkt = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16);
  await page.getByLabel("Bank receipt / refund time HKT").fill(hkt);
  await page
    .getByLabel("Reconciliation / refund note")
    .fill("Checked actual bank receipt independently");
  await page
    .getByRole("checkbox", { name: /I independently checked the actual bank/ })
    .check();
  await page
    .getByRole("button", {
      name: "Confirm bank receipt after reconciliation",
      exact: true,
    })
    .click();
  await expect(page.locator(".ev-state")).toContainText("Payment verified");
  await page
    .getByText("Dispatch preview (no name, phone or unit)", { exact: true })
    .click();
  const preview = page.locator("details:not(.ev-workflow)").filter({
    has: page.getByText("Dispatch preview (no name, phone or unit)", {
      exact: true,
    }),
  });
  await expect(preview).toContainText("HK$245／小時，共 HK$980");
  await expect(preview).toContainText("Workflow Building");
  await expect(preview).not.toContainText("family@careknock.invalid");
  await page.screenshot({
    path: "test-results/v3-dispatch-preview.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Approve preview and dispatch", exact: true })
    .click();
  await expect(page.locator(".ev-state")).toContainText("Recruiting nurse");
  state = await (await page.request.get("/api/workflow")).json();
  const broadcast = state.emails.find(
    (m: { case_id: string; template_id: string; to: string }) =>
      m.case_id === c.id && m.template_id === "T3" && m.to === provider.email,
  );
  expect(broadcast.body).not.toContain("family@careknock.invalid");
  expect(broadcast.body).toContain("HK$245／小時，共 HK$980");
  expect((await page.request.post(broadcast.links[0].url)).ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator(".ev-state")).toContainText("Nurse assigned");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Care schedule", exact: true })
    .click();
  await expect(page.getByRole("row").filter({ hasText: c.id })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Client records", exact: true })
    .click();
  await expect(
    page.locator("summary").filter({ hasText: "LIVE-BROWSER-TEST" }),
  ).toBeVisible();
  await family.close();
});
