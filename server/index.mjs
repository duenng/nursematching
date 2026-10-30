import { confirmationDetails } from "./workflow-content.mjs";
import http from "node:http";
import { readFile } from "node:fs/promises";
import {
  openSync,
  readFileSync,
  writeFileSync,
  closeSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";
import { resolve, extname } from "node:path";
import {
  documentStore,
  readSampleUpload,
  storeSample,
} from "./doctor-documents.mjs";
import { staffSnapshot, saveNurse } from "./staff-workspace.mjs";
import { publicIntake, createIntakeLimiter } from "./public-intake.mjs";
import { organiseEnquiry, publicAssistantConfig } from "./intake-assistant.mjs";
import { createConversationEnquiry } from "./conversation-intake.mjs";
import { StaffAuth, canAccess, clinicalWorkspace } from "./auth.mjs";
import nodemailer from "nodemailer";
import { Workflow } from "./workflow.mjs";
import { ACTION_LABELS, emailHtml } from "./templates.mjs";
import { EXPERIMENT_POLICIES } from "./extended-workflow.mjs";

const port = Number(process.env.API_PORT || process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const normalizeOrigin = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed ? new URL(trimmed).origin : "";
};
const frontendUrl = normalizeOrigin(process.env.FRONTEND_URL);
const corsOrigins = new Set(
  [
    frontendUrl,
    ...(process.env.CORS_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ]
    .map(normalizeOrigin)
    .filter(Boolean),
);
const mode = process.env.PAYMENT_MODE || "bank_transfer";
if (!["bank_transfer", "fps_test", "mock", "stripe_test"].includes(mode))
  throw new Error("Unsupported PAYMENT_MODE");
if (mode === "stripe_test" && !process.env.STRIPE_SECRET_KEY)
  throw new Error("Stripe test key missing");
if (
  process.env.STRIPE_SECRET_KEY &&
  !process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")
)
  throw new Error("Only Stripe test keys are supported");
const dbPath = process.env.WORKFLOW_DB || "data/workflow.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
const lockPath = dbPath + ".lock";
try {
  const previous = Number(readFileSync(lockPath, "utf8"));
  if (previous) {
    try {
      process.kill(previous, 0);
      throw new Error(
        "Workflow database already in use; run exactly one server instance",
      );
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      unlinkSync(lockPath);
    }
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const lock = openSync(lockPath, "wx");
writeFileSync(lock, String(process.pid));
closeSync(lock);
process.on("exit", () => {
  try {
    unlinkSync(lockPath);
  } catch {}
});
if (!["live", "test"].includes(process.env.WORKSPACE_MODE || "live"))
  throw new Error("WORKSPACE_MODE must be live or test");
const live = (process.env.WORKSPACE_MODE || "live") === "live";
const workflow = new Workflow(dbPath, {
  seedNurses: !live,
  baseUrl:
    process.env.BASE_URL ||
    `http://localhost:${process.env.API_PORT ? "5173" : port}`,
  paymentMode: mode,
  fpsRecipient: process.env.FPS_TEST_RECIPIENT || "",
  fpsAccountName: process.env.FPS_TEST_ACCOUNT_NAME || "",
  bankName: process.env.BANK_NAME || "",
  bankAccountName: process.env.BANK_ACCOUNT_NAME || "",
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
});
if (
  ["bank_transfer", "stripe_test"].includes(mode) &&
  (workflow.state.settings.time_scale !== 1 || workflow.state.clock_offset_ms)
)
  throw new Error(
    "Real payment modes require time_scale=1 and no virtual clock offset; use a separate WORKFLOW_DB",
  );
workflow.live = live;
if (live && mode !== "bank_transfer")
  throw new Error(
    "Live workspace requires PAYMENT_MODE=bank_transfer; use WORKSPACE_MODE=test for test payments",
  );
documentStore(workflow.db);
const auth = new StaffAuth(workflow.db, {
  baseUrl: workflow.baseUrl,
  frontendUrl,
  allowedOrigins: [...corsOrigins],
  audit: (event, detail) => {
    workflow.event(event, null, detail);
    workflow.save();
  },
});
if (
  live &&
  auth.mode !== "google" &&
  !["localhost", "127.0.0.1"].includes(new URL(workflow.baseUrl).hostname)
)
  throw new Error("Public live workspaces require AUTH_MODE=google");
const realNow = Date.now;
workflow.now = () => realNow() + (workflow.state.clock_offset_ms || 0);
const testClock =
  process.env.ENABLE_TEST_CLOCK === "true" &&
  !process.env.SMTP_HOST &&
  !["stripe_test", "bank_transfer"].includes(mode);
const allowed = new Set(
  (process.env.TEST_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === "465",
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const names = ACTION_LABELS;
function requestOrigin(req) {
  return req.headers.origin || "";
}
function originAllowed(req) {
  const origin = requestOrigin(req);
  return origin === new URL(workflow.baseUrl).origin || corsOrigins.has(origin);
}
const html = (title, body, { paymentNotice = true } = {}) =>
  `<!doctype html><html lang="zh-HK"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(title)} · CareKnock</title><style>body{font:18px/1.7 system-ui;background:#f5f2f8;color:#302044;padding:6vw 20px}main{max-width:620px;margin:auto;background:white;border-radius:24px;padding:32px}button,a{font:inherit}button{background:#694084;color:white;border:0;padding:14px 24px;border-radius:12px;cursor:pointer}input{font:inherit;padding:12px;max-width:90%;margin:12px 0}small{color:#686071}pre{white-space:pre-wrap}</style><main><small>CareKnock</small><h1>${escape(title)}</h1>${body}${paymentNotice ? `<p><small>${mode === "bank_transfer" ? "客人人手轉帳，同事核對銀行入帳。提交轉帳資料不代表已確認收款。" : mode === "fps_test" ? "FPS 人手對數測試；請勿真實轉帳。提交參考編號不代表已收款。" : mode === "mock" ? "付款使用本機模擬，未連接支付服務。" : "Stripe test mode；不會收取真實款項。"}</small></p>` : ""}</main></html>`;
function reply(res, status, body, type = "application/json") {
  const origin = requestOrigin(res.req || {});
  res.writeHead(status, {
    "Content-Type": `${type}; charset=utf-8`,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
    ...(origin &&
    (origin === new URL(workflow.baseUrl).origin || corsOrigins.has(origin))
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-CSRF-Token",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          Vary: "Origin",
        }
      : {}),
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}
async function body(req) {
  let text = "";
  for await (const part of req) {
    text += part;
    if (text.length > 64000) throw new Error("Request too large");
  }
  return req.headers["content-type"]?.includes("application/json")
    ? JSON.parse(text || "{}")
    : Object.fromEntries(new URLSearchParams(text));
}
async function stripe(path, fields, method = "POST", idempotency) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    ...(method === "POST" ? { body: new URLSearchParams(fields) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Stripe test request failed");
  return data;
}
let working = false;
async function integrations() {
  if (working) return;
  working = true;
  try {
    for (const c of workflow.state.cases) {
      try {
        if (
          mode === "stripe_test" &&
          c.checkout_pending &&
          c.status === "PENDING_PAY"
        ) {
          const session = await stripe(
            "checkout/sessions",
            {
              mode: "payment",
              "line_items[0][price_data][currency]": "hkd",
              "line_items[0][price_data][product_data][name]": `TEST ${c.id}`,
              "line_items[0][price_data][unit_amount]": String(
                (c.payment_amount ?? c.quote.total) * 100,
              ),
              "line_items[0][quantity]": "1",
              client_reference_id: c.id,
              "metadata[case_id]": c.id,
              expires_at: String(
                Math.floor(Date.parse(c.payment_deadline) / 1000),
              ),
              success_url: `${workflow.baseUrl}/payment-return`,
              cancel_url: `${workflow.baseUrl}/payment-return`,
            },
            "POST",
            `checkout-${c.id}-${c.created_at}`,
          );
          c.stripe_session = session.id;
          c.checkout_url = session.url;
          c.stripe_payment_intent = session.payment_intent;
          c.checkout_pending = false;
          if (c.status === "PENDING_PAY") workflow.paymentEmail(c);
          else c.checkout_expire_pending = true;
          workflow.save();
        }
        if (
          mode === "stripe_test" &&
          c.stripe_session &&
          c.status === "PENDING_PAY"
        ) {
          const session = await stripe(
            `checkout/sessions/${encodeURIComponent(c.stripe_session)}`,
            {},
            "GET",
          );
          if (
            session.payment_status === "paid" &&
            session.amount_total ===
              (c.payment_amount ?? c.quote.total) * 100 &&
            session.currency === "hkd" &&
            session.client_reference_id === c.id &&
            session.livemode === false
          ) {
            if (Date.parse(c.payment_deadline) > workflow.now()) {
              c.stripe_payment_intent = session.payment_intent;
              workflow.paid(c);
            } else {
              workflow.event("payment.late_received", c, {
                reason: "需人手核對，不自動派單",
              });
              c.late_payment = true;
            }
          }
        }
        if (
          mode === "stripe_test" &&
          c.refund_pending &&
          c.refund_status === "APPROVED"
        ) {
          if (!c.stripe_payment_intent)
            throw new Error("Stripe test payment intent missing");
          const refund = await stripe(
            "refunds",
            {
              payment_intent: c.stripe_payment_intent,
              amount: String(c.refund_amount * 100),
            },
            "POST",
            `refund-${c.id}-${c.created_at}`,
          );
          if (refund.status === "succeeded") {
            workflow.finishRefund(c, "stripe_test", refund.id);
            c.refund_pending = false;
            workflow.save();
          } else {
            c.stripe_refund_id = refund.id;
            c.refund_pending = false;
            c.refund_processing = true;
            workflow.save();
          }
        }
        if (mode === "stripe_test" && c.refund_processing) {
          const refund = await stripe(
            `refunds/${encodeURIComponent(c.stripe_refund_id)}`,
            {},
            "GET",
          );
          if (refund.status === "succeeded") {
            workflow.finishRefund(c, "stripe_test", refund.id);
            c.refund_processing = false;
            workflow.save();
          }
        }
        if (mode === "stripe_test" && c.checkout_expire_pending) {
          await stripe(
            `checkout/sessions/${encodeURIComponent(c.stripe_session)}/expire`,
            {},
          );
          c.checkout_expire_pending = false;
          workflow.save();
        }
      } catch (error) {
        workflow.event("integration.error", c, { reason: error.message });
        workflow.save();
      }
    }
    // Poll Stripe before expiry so a payment made just before the deadline is observed first.
    workflow.tick();
    for (const mail of workflow.state.emails.filter(
      (x) => x.status === "queued",
    )) {
      if (
        live &&
        !workflow.state.cases.some(
          (c) => c.id === mail.case_id && c.intake_mode === "LIVE",
        )
      )
        continue;
      const mailCase = workflow.state.cases.find((c) => c.id === mail.case_id);
      if (!mailer) {
        mail.status = "captured";
        workflow.event(
          "email.captured",
          { id: mail.case_id },
          {
            template_id: mail.template_id,
            template_version: mail.template_version,
            to_code:
              workflow.state.nurses.find((n) => n.email === mail.to)?.id ||
              (mail.to === mailCase?.email
                ? `CLIENT-${mail.case_id}`
                : "ADMIN"),
          },
        );
        continue;
      }
      if (live && mailCase?.intake_mode !== "LIVE") continue;
      if ((!live || allowed.size > 0) && !allowed.has(mail.to.toLowerCase())) {
        mail.status = "blocked";
        mail.error = "Recipient is not in TEST_EMAIL_ALLOWLIST";
        continue;
      }
      mail.status = "sending";
      mail.attempts++;
      workflow.save();
      try {
        const info = await mailer.sendMail({
          from: {
            name: workflow.state.settings.sender_name,
            address:
              process.env.SMTP_FROM?.match(/<([^<>]+)>/)?.[1] ||
              process.env.SMTP_FROM ||
              process.env.SMTP_USER,
          },
          to: mail.to,
          subject: mail.subject,
          html: emailHtml(mail),
          replyTo: workflow.state.admin_email,
          text:
            mail.body +
            "\n\n" +
            mail.links
              .map((l) => `${names[l.label] || l.label}: ${l.url}`)
              .join("\n"),
          messageId: `<${mail.id}@careknock.local>`,
        });
        mail.status = "sent";
        mail.provider_id = info.messageId;
        mail.sent_at = workflow.stamp();
        workflow.event(
          "email.sent",
          { id: mail.case_id },
          {
            template_id: mail.template_id,
            template_version: mail.template_version,
            to_code:
              workflow.state.nurses.find((n) => n.email === mail.to)?.id ||
              (mail.to === mailCase?.email
                ? `CLIENT-${mail.case_id}`
                : "ADMIN"),
          },
        );
        workflow.event(
          "email.smtp_accepted",
          { id: mail.case_id },
          {
            template_id: mail.template_id,
            template_version: mail.template_version,
            to_code:
              workflow.state.nurses.find((n) => n.email === mail.to)?.id ||
              (mail.to === mailCase?.email
                ? `CLIENT-${mail.case_id}`
                : "ADMIN"),
          },
        );
      } catch (error) {
        mail.status = "failed";
        mail.error = error.message;
      }
    }
    workflow.save();
  } finally {
    working = false;
  }
}
const intakeAllowed = createIntakeLimiter();
const assistantAllowed = createIntakeLimiter();
let assistantRequests = 0;
const server = http.createServer(async (req, res) => {
  res.req = req;
  const url = new URL(req.url, "http://localhost");
  try {
    if (
      req.method === "OPTIONS" &&
      (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/"))
    ) {
      if (!originAllowed(req))
        return reply(res, 403, { error: "Origin not allowed" });
      return reply(res, 204, "");
    }
    if (url.pathname === "/api/enquiries/assistant-config" && req.method === "GET")
      return reply(res, 200, publicAssistantConfig());
    if (url.pathname === "/api/enquiries/assistant" && req.method === "POST") {
      if (
        !originAllowed(req) ||
        !req.headers["content-type"]?.includes("application/json")
      )
        return reply(res, 403, { error: "Origin or content type not allowed" });
      if (!assistantAllowed(req.socket.remoteAddress) || assistantRequests >= 4)
        return reply(res, 429, {
          error: "AI 查詢繁忙，請稍後再試。 / Please try again shortly.",
        });
      assistantRequests++;
      try {
        return reply(res, 200, await organiseEnquiry(await body(req)));
      } finally {
        assistantRequests--;
      }
    }
    if (
      url.pathname === "/api/enquiries/conversation" &&
      req.method === "POST"
    ) {
      if (
        !originAllowed(req) ||
        !req.headers["content-type"]?.includes("application/json")
      )
        return reply(res, 403, { error: "Origin or content type not allowed" });
      if (!intakeAllowed(req.socket.remoteAddress))
        return reply(res, 429, { error: "查詢過於頻密，請稍後再試" });
      const c = createConversationEnquiry(workflow, await body(req));
      void integrations().catch((error) => console.error(error.message));
      return reply(res, 200, { id: c.id, status: c.status });
    }
    if (url.pathname === "/api/enquiries" && req.method === "POST") {
      if (
        !originAllowed(req) ||
        !req.headers["content-type"]?.includes("application/json")
      )
        return reply(res, 403, { error: "Origin or content type not allowed" });
      if (!intakeAllowed(req.socket.remoteAddress))
        return reply(res, 429, { error: "查詢過於頻密，請稍後再試" });
      const c = workflow.create(publicIntake(await body(req)));
      void integrations().catch((error) => console.error(error.message));
      return reply(res, 200, {
        id: c.id,
        status: c.status,
        ...(c.status === "QUOTED" ? { quote: c.quote } : {}),
      });
    }
    if (url.pathname === "/api/health")
      return reply(res, 200, {
        ok: true,
        workspace: live ? "live" : "test",
        email: mailer ? (live ? "smtp" : "smtp_test") : "local_inbox",
        email_delivery_enabled: !!mailer,
        email_restricted: !live || allowed.size > 0,
        payment: mode,
        auth:
          auth.mode === "google"
            ? "google"
            : process.env.WORKFLOW_ADMIN_KEY
              ? "shared_key"
              : "loopback_only",
      });
    if (url.pathname === "/auth/session" && req.method === "GET") {
      const user = auth.current(req);
      return reply(res, 200, {
        mode: auth.mode,
        user,
        login_url: auth.mode === "google" ? "/auth/google" : null,
      });
    }
    if (url.pathname === "/auth/google" && req.method === "GET") {
      const login = await auth.begin();
      res.writeHead(302, {
        Location: login.location,
        "Set-Cookie": login.cookie,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      });
      return res.end();
    }
    if (url.pathname === "/auth/google/callback" && req.method === "GET") {
      const login = await auth.finish(req, url);
      res.writeHead(303, {
        Location: login.location,
        "Set-Cookie": login.cookies,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      });
      return res.end();
    }
    if (url.pathname === "/auth/logout" && req.method === "POST") {
      const user = auth.current(req);
      if (!user || !auth.verifyMutation(req, user))
        return reply(res, 403, { error: "Invalid session or CSRF token" });
      res.setHeader("Set-Cookie", auth.logout(req));
      return reply(res, 200, { ok: true });
    }
    if (url.pathname === "/a") {
      const token = url.searchParams.get("t");
      if (live) {
        const actionCase = workflow.state.tokens.find(
          (t) => t.token === token,
        )?.case_id;
        if (
          !workflow.state.cases.some(
            (c) => c.id === actionCase && c.intake_mode === "LIVE",
          )
        )
          throw new Error("連結已失效");
      }
      if (req.method === "GET") {
        const { t, c } = workflow.inspect(token);
        if (t.action === "upload_doctor")
          return reply(
            res,
            200,
            html(
              c.intake_mode === "LIVE"
                ? "上載醫生指示文件"
                : "上載虛構醫生指示樣本",
              `<p>Case ${escape(c.id)}。${c.intake_mode === "LIVE" ? "請上載醫生指示文件，" : "只用虛構樣本，"}PDF／PNG／JPEG，最多 2 MB。文件只供受權職員覆核。</p><form method="POST" enctype="multipart/form-data" action="/a?t=${escape(token)}"><label>文件<input type="file" name="sample" accept="application/pdf,image/png,image/jpeg" required></label><label><input type="checkbox" name="${c.intake_mode === "LIVE" ? "consent" : "fictional"}" value="yes" required>${c.intake_mode === "LIVE" ? "我確認有權提交此文件，並同意供受權職員核對及安排服務。" : "我確認是虛構醫生指示樣本"}</label><button type="submit">確認上載</button></form>`,
            ),
            "text/html",
          );
        if (t.action === "take_case" && c.assigned_nurse)
          return reply(
            res,
            200,
            html(
              "Case 已有人接",
              `<p>Case ${escape(c.id)} 已有護士接咗，多謝你報名。</p>`,
            ),
            "text/html",
          );
        return reply(
          res,
          200,
          html(
            names[t.action] || "確認操作",
            `<p>Case ${escape(c.id)} · ${escape(c.status)}</p><pre>${escape(confirmationDetails(c, t.action, workflow.state.settings, workflow.now()))}</pre><p>開啟此頁不會接受報價、付款或接單。請按確認掣先執行。</p><form method="POST" action="/a?t=${escape(token)}">${t.action === "report_fps" ? `<p>應付 HK$${escape(c.payment_amount ?? c.quote.total)}。本頁只登記轉帳聲明，管理員須獨立核對入帳，先可派單。${mode === "bank_transfer" ? "請填寫已完成轉帳的資料；如已提交，請勿重複轉帳。" : "測試請使用虛構編號，不要轉帳。"}</p><label>轉帳參考編號<br><input name="reference" required maxlength="100" autocomplete="off"></label><br><label>轉帳金額 HKD<br><input name="amount" type="number" min="1" step="1" required></label><br><label>轉帳時間 HKT<br><input name="transferred_at" type="datetime-local" required></label><br>` : ""}${t.action === "drop" ? '<label>放飛原因<br><input name="reason" required maxlength="300"></label><p>放飛會記錄，累計 3 次將無法再接單。</p>' : ""}${t.action === "provide_unit" ? '<label>樓層及單位<br><input name="unit" required maxlength="200" autocomplete="off"></label><br>' : ""}<button type="submit">確認：${escape(names[t.action])}</button></form>`,
          ),
          "text/html",
        );
      }
      if (req.method === "POST") {
        const t = workflow.state.tokens.find((t) => t.token === token);
        if (t?.action === "upload_doctor") {
          const c = workflow.state.cases.find((c) => c.id === t.case_id);
          workflow.valid(t, c);
          if (req.headers.origin && !originAllowed(req))
            return reply(res, 403, { error: "Origin not allowed" });
          storeSample(
            workflow,
            token,
            await readSampleUpload(req, { live: c.intake_mode === "LIVE" }),
          );
          return reply(
            res,
            200,
            html(
              "已收到文件",
              "<p>文件已保存，仍待資深護士核對；上載不代表已通過。</p>",
            ),
            "text/html",
          );
        }
        const result = workflow.act(token, await body(req));
        void integrations().catch((error) => console.error(error.message));
        return reply(
          res,
          200,
          html("操作結果", `<p>${escape(result)}</p>`),
          "text/html",
        );
      }
      return reply(res, 405, { error: "Method not allowed" });
    }
    if (url.pathname === "/payment-return")
      return reply(
        res,
        200,
        html(
          "付款狀態核對中",
          "<p>系統會向 Stripe test mode 核實付款；返回此頁本身不會標記已付款。請返回驗證台查看。</p>",
        ),
        "text/html",
      );
    if (url.pathname.startsWith("/api/")) {
      const user = auth.current(req);
      if (!user)
        return reply(res, 401, {
          error:
            auth.mode === "google"
              ? "請先使用獲准職員 Google 帳戶登入"
              : "請輸入 WORKFLOW_ADMIN_KEY；未設定時只容許本機管理",
        });
      if (req.method !== "GET" && !auth.verifyMutation(req, user))
        return reply(res, 403, { error: "Origin or CSRF token not allowed" });
      if (
        url.pathname.startsWith("/api/doctor-document/") &&
        req.method === "GET"
      ) {
        const id = url.pathname.slice("/api/doctor-document/".length);
        const doc = workflow.db
          .prepare("SELECT * FROM doctor_documents WHERE id=?")
          .get(id);
        if (!doc) return reply(res, 404, { error: "找不到文件" });
        workflow.asOperator(user, () => {
          workflow.event(
            "doctor_document.viewed",
            { id: doc.case_id },
            { document_id: id, sha256: doc.sha256 },
          );
          workflow.save();
        });
        res.writeHead(200, {
          "Content-Type": doc.media_type,
          "Content-Length": doc.content.length,
          "Content-Disposition": `attachment; filename="doctor-order-${doc.id}.${doc.media_type === "application/pdf" ? "pdf" : doc.media_type === "image/png" ? "png" : "jpg"}"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
          "Referrer-Policy": "no-referrer",
        });
        return res.end(Buffer.from(doc.content));
      }
      if (url.pathname === "/api/workflow" && req.method === "GET")
        return reply(res, 200, {
          ...(user.role === "SENIOR_NURSE"
            ? clinicalWorkspace(staffSnapshot(workflow.state, live))
            : staffSnapshot(workflow.state, live)),
          staff: { id: user.id, role: user.role, method: user.method },
          capabilities: {
            workspace: live ? "live" : "test",
            email: mailer ? (live ? "smtp" : "smtp_test") : "local_inbox",
            email_delivery_enabled: !!mailer,
            email_restricted: !live || allowed.size > 0,
            payment: mode,
            live_ai: publicAssistantConfig().enabled,
            bank_transfer_configured: workflow.bankTransferConfigured(),
            fps_configured: !!(
              process.env.FPS_TEST_RECIPIENT &&
              process.env.FPS_TEST_ACCOUNT_NAME
            ),
            clock_offset_ms: workflow.state.clock_offset_ms || 0,
            test_clock: testClock,
            server_now: workflow.stamp(),
          },
        });
      const input = await body(req);
      if (!canAccess(user, url.pathname, req.method, input))
        return reply(res, 403, {
          error: "此職員角色無權執行操作；護士覆核與管理員批核須由相應角色操作",
        });
      return await workflow.asOperator(user, async () => {
        let result;
        if (url.pathname === "/api/cases" && req.method === "POST")
          result = workflow.create(live ? publicIntake(input) : input);
        else if (url.pathname === "/api/nurses" && req.method === "POST")
          result = saveNurse(workflow, input);
        else if (url.pathname === "/api/email-retry" && req.method === "POST") {
          const mail = workflow.state.emails.find((m) => m.id === input.id);
          if (
            !mail ||
            !["failed", "blocked", "captured"].includes(mail.status) ||
            (live &&
              !workflow.state.cases.some(
                (c) => c.id === mail.case_id && c.intake_mode === "LIVE",
              ))
          )
            throw new Error("只可重試未寄出或已失敗的通知");
          if (!mailer) throw new Error("請先設定 SMTP 寄信連線");
          if (
            (!live || allowed.size > 0) &&
            !allowed.has(mail.to.toLowerCase())
          )
            throw new Error("收件地址不在允許名單，請先更新寄信設定");
          mail.status = "queued";
          delete mail.error;
          workflow.event(
            "email.retry_requested",
            { id: mail.case_id },
            { email_id: mail.id },
          );
          workflow.save();
          result = { ok: true };
        } else if (url.pathname === "/api/payout" && req.method === "POST") {
          result = workflow.transaction(() => {
            const payout = workflow.state.payouts.find(
              (p) => p.id === input.id,
            );
            if (
              !payout ||
              (live &&
                !workflow.state.cases.some(
                  (c) => c.id === payout.case_id && c.intake_mode === "LIVE",
                )) ||
              payout.status !== "PENDING" ||
              !input.bank_reference?.trim() ||
              !input.note?.trim() ||
              input.verified !== true
            )
              throw new Error("請核實待付薪酬、銀行參考及付款說明");
            const paidAt = Date.parse(input.paid_at);
            if (
              !Number.isFinite(paidAt) ||
              paidAt > Date.now() ||
              Number(input.amount) !== payout.total
            )
              throw new Error("付款金額或時間不符");
            if (
              workflow.state.payouts.some(
                (p) => p.bank_reference === input.bank_reference.trim(),
              )
            )
              throw new Error("銀行參考已使用");
            Object.assign(payout, {
              status: "PAID",
              paid_at: new Date(paidAt).toISOString(),
              bank_reference: input.bank_reference.trim(),
              note: input.note.trim(),
              paid_by: user.id,
            });
            workflow.event(
              "payout.recorded",
              { id: payout.case_id },
              { payout_id: payout.id, amount: payout.total },
            );
            return payout;
          });
        } else if (url.pathname === "/api/settings" && req.method === "POST") {
          if (
            workflow.state.cases.some(
              (c) =>
                ![
                  "MANUAL",
                  "NO_DR_ORDER",
                  "NO_FIRST_INSERT",
                  "CANCELLED",
                  "PAY_TIMEOUT",
                  "EXPIRED",
                  "DONE",
                ].includes(c.status) &&
                (!live || c.intake_mode === "LIVE"),
            )
          )
            throw new Error("有進行中個案，請保留設定以免改變計時／薪酬");
          if (
            live &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.admin_email || "")
          )
            throw new Error("請提供有效管理員電郵");
          const scale = Number(input.time_scale);
          if (
            ![1, 60].includes(scale) ||
            (["bank_transfer", "stripe_test"].includes(mode) && scale !== 1)
          )
            throw new Error(
              "人手轉帳及 Stripe 必須使用真實時間；本機模擬可選 1 或 60",
            );
          for (const key of ["nurse_day_rate", "nurse_night_rate"])
            if (
              !Number.isInteger(Number(input[key])) ||
              Number(input[key]) <= 0
            )
              throw new Error("請確認正整數護士測試薪酬");
          for (const n of live ? [] : workflow.state.nurses) {
            const email = input.nurses?.find((x) => x.id === n.id)?.email;
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ""))
              throw new Error("護士電郵無效");
          }
          workflow.transaction(() => {
            for (const [name, defaultValue] of Object.entries(
              EXPERIMENT_POLICIES,
            )) {
              if (input.policies && name in input.policies) {
                const value = input.policies[name];
                if (
                  typeof defaultValue === "boolean" &&
                  typeof value !== "boolean"
                )
                  throw new Error("Policy value invalid");
                if (
                  name === "package_offer_rule" &&
                  !["MANUAL", "WEEKDAY_DAY_LE30"].includes(value)
                )
                  throw new Error("套餐設定無效");
                workflow.state.settings[name] = value;
              }
            }
            workflow.state.settings.time_scale = scale;
            workflow.state.settings.nurse_day_rate = Number(
              input.nurse_day_rate,
            );
            workflow.state.settings.nurse_night_rate = Number(
              input.nurse_night_rate,
            );
            if (!live)
              workflow.state.nurses.forEach(
                (n) =>
                  (n.email = input.nurses.find((x) => x.id === n.id).email),
              );
            workflow.state.admin_email =
              input.admin_email || "admin@example.test";
            workflow.event("settings.confirmed", null, { actor: "admin" });
            workflow.save();
          });
          result = { ok: true };
        } else if (
          url.pathname === "/api/case-action" &&
          req.method === "POST"
        ) {
          const c = workflow.state.cases.find((c) => c.id === input.id);
          if (!c || (live && c.intake_mode !== "LIVE"))
            throw new Error("找不到個案");
          if (input.action === "mock_paid") {
            if (mode !== "mock")
              throw new Error(
                "人手轉帳須先對數；Stripe 須等待 test 付款，不可直接標記",
              );
            workflow.paid(c);
          } else if (input.action === "dispatch") workflow.dispatch(c);
          else if (["draft", "nurse", "admin"].includes(input.action))
            workflow.review(c, input.action, input);
          else if (input.action === "reject_fps") workflow.rejectFPS(c, input);
          else if (input.action === "reconcile_fps")
            workflow.reconcileFPS(c, input);
          else if (input.action === "record_fps_refund")
            workflow.recordFPSRefund(c, input);
          else workflow.adminCase(c, input.action, input);
          result = c;
        } else if (
          url.pathname === "/api/nurse-action" &&
          req.method === "POST"
        ) {
          const n = workflow.state.nurses.find((n) => n.id === input.id);
          if (
            !n ||
            n.status !== "SUSPENDED" ||
            input.action !== "blacklist" ||
            !input.reason?.trim()
          )
            throw new Error("只能批核已暫停護士，並須提供原因");
          n.status = "BLACKLISTED";
          n.blacklisted_at = workflow.stamp();
          n.blacklisted_by = user.id;
          workflow.event("nurse.blacklisted", null, {
            actor: "admin",
            nurse: n.id,
          });
          const c = workflow.state.cases.find(
            (c) => c.id === n.drop_log?.at(-1)?.case_id,
          );
          if (c)
            workflow.email(
              c,
              "T23",
              n.email,
              "接單資格取消",
              "你好，由於累計放飛 3 次，你嘅接單資格已取消。如有疑問請聯絡管理員。",
            );
          workflow.save();
          result = { ok: true };
        } else if (
          url.pathname === "/api/remote-import" &&
          req.method === "POST"
        ) {
          if (
            !input.version?.trim() ||
            !Array.isArray(input.rows) ||
            input.rows.some(
              (r) =>
                !r.place ||
                !["A", "B", "C", "ADMIN", "NOT_SERVED"].includes(r.tier),
            )
          )
            throw new Error("偏遠名單格式無效");
          workflow.state.remote_list = input.rows.map((r) => ({
            place: r.place,
            tier: r.tier,
            district: r.district || "",
            list_version: input.version,
          }));
          workflow.event("remote.imported", null, {
            actor: "admin",
            count: input.rows.length,
            version: input.version,
          });
          workflow.save();
          result = { ok: true };
        } else if (url.pathname === "/api/evidence" && req.method === "POST") {
          if (
            !input.requirement ||
            !["PASS", "FAIL", "PENDING"].includes(input.result) ||
            !input.note?.trim()
          )
            throw new Error("請填驗收項目、結果及證據說明");
          workflow.state.evidence.push({
            id: crypto.randomUUID(),
            requirement: input.requirement,
            result: input.result,
            note: input.note,
            artifact: input.artifact || "",
            at: workflow.stamp(),
            actor: user.id,
            payment_mode: mode,
            email_mode: mailer ? "smtp_test" : "local_inbox",
            time_scale: workflow.state.settings.time_scale,
          });
          workflow.event("evidence.recorded", null, {
            actor: "admin",
            requirement: input.requirement,
            result: input.result,
          });
          workflow.save();
          result = { ok: true };
        } else if (
          url.pathname === "/api/email-receipt" &&
          req.method === "POST"
        ) {
          const m = workflow.state.emails.find((m) => m.id === input.id);
          if (!m || m.status !== "sent" || !input.note?.trim())
            throw new Error("只可記錄已寄出測試信件的人工收件確認");
          m.receipt_confirmed_at = workflow.stamp();
          m.receipt_confirmed_by = user.id;
          workflow.event(
            "email.receipt_confirmed",
            { id: m.case_id },
            { actor: "admin", template_id: m.template_id },
          );
          workflow.save();
          result = { ok: true };
        } else if (
          url.pathname === "/api/test-clock" &&
          req.method === "POST"
        ) {
          if (!testClock)
            throw new Error(
              "虛擬時鐘未啟用；只可本機虛構實驗、停用外部寄信時使用",
            );
          const to = Date.parse(input.to);
          if (
            !Number.isFinite(to) ||
            to < workflow.now() ||
            to - workflow.now() > 90 * 86400000
          )
            throw new Error("只可向前推進最多 90 天");
          workflow.state.clock_offset_ms = to - realNow();
          workflow.event("experiment.clock_advanced", null, {
            actor: "admin",
            to: new Date(to).toISOString(),
            clock: "VIRTUAL_NOT_WALL_TIME",
          });
          workflow.tick();
          workflow.save();
          result = { ok: true };
        } else if (url.pathname === "/api/tick" && req.method === "POST") {
          await workflow.asOperator(null, integrations);
          result = { ok: true };
        } else return reply(res, 404, { error: "Not found" });
        void workflow
          .asOperator(null, integrations)
          .catch((error) => console.error(error.message));
        return reply(
          res,
          200,
          user.role === "SENIOR_NURSE" && url.pathname === "/api/case-action"
            ? clinicalWorkspace({ cases: [result] }).cases[0]
            : result,
        );
      });
    }
    if (process.env.API_PORT)
      return reply(res, 404, { error: "Use the Vite frontend on port 5173" });
    if (req.method !== "GET")
      return reply(res, 405, { error: "Method not allowed" });
    const root = resolve("dist");
    const path = resolve(root, "." + decodeURIComponent(url.pathname));
    if (!path.startsWith(root + "/") && path !== root)
      return reply(res, 403, { error: "Forbidden" });
    const types = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".ico": "image/x-icon",
    };
    try {
      const file = await readFile(path);
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
      });
      res.end(file);
    } catch {
      reply(
        res,
        200,
        await readFile(resolve(root, "index.html"), "utf8"),
        "text/html",
      );
    }
  } catch (error) {
    workflow.save();
    const isAuth = url.pathname.startsWith("/auth/");
    const isAction = url.pathname === "/a";
    reply(
      res,
      error.status || 400,
      isAction || isAuth
        ? isAuth
          ? html(
              "登入未完成",
              '<p>登入連結已失效，請重新開始。</p><p><a href="/auth/google">返回職員登入</a></p>',
              { paymentNotice: false },
            )
          : html("連結已失效／操作未完成", `<p>${escape(error.message)}</p>`)
        : { error: error.message },
      isAction || isAuth ? "text/html" : "application/json",
    );
  }
});
// Interrupted deliveries need explicit inspection; never resend automatically after a crash.
for (const mail of workflow.state.emails.filter((x) => x.status === "sending"))
  mail.status = "delivery_unknown";
workflow.save();
server.listen(port, host, () =>
  console.log(
    `TRL 3 workflow server listening on ${host}:${port}; email=${mailer ? "SMTP allowlist" : "local inbox"}; payment=${mode}`,
  ),
);
const interval = setInterval(
  () => void integrations().catch((error) => console.error(error.message)),
  60000,
);
interval.unref();
void integrations().catch((error) => console.error(error.message));
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    clearInterval(interval);
    server.close(() => {
      workflow.db.close();
      process.exit(0);
    });
  });
