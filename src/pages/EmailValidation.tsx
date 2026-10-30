import { useEffect, useRef, useState } from "react";
import {
  Mail,
  RefreshCw,
  Download,
  ArrowRight,
  FlaskConical,
  LockKeyhole,
} from "lucide-react";
import { LanguageSwitcher, useLocale } from "../i18n";
import { useStaffAccess } from "../StaffAccess";
import type { StaffSession } from "../StaffAccess";
import { apiUrl } from "../lib/api";
import "./email-validation.css";
import catalog from "../../server/catalog/services.json";
import { EmailPreview } from "../EmailPreview";
import { ConversationEnquiry } from "./ConversationEnquiry";
import { DispatchDelivery } from "./DispatchDelivery";
import { DayTimeSelect, PreferredTimeFields } from "../CareTimeFields";
import {
  CaseOverview,
  caseStatusLabel,
  refundStatusLabel,
} from "./CaseOverview";

type Service = { id: string; label: string; times: string[]; prn: boolean };
export type Case = {
  id: string;
  client_id?: string;
  patient_ref?: string;
  phone?: string;
  intake_mode?: string;
  created_at?: string;
  surname: string;
  email: string;
  status: string;
  manual_reason?: string;
  dispatch_preview_body?: string;
  doctor_order?: string;
  existing_tubes?: Record<string, string>;
  remarks?: string;
  other_need_text?: string;
  medical_history?: string;
  red_flag?: boolean;
  date: string;
  shift?: string;
  start: string;
  end: string;
  district: string;
  building: string;
  visits?: { date: string; shift?: string; start: string; end: string }[];
  intake_channel?: string;
  enquiry_summary?: string;
  preferred_timing?: string;
  quote?: {
    total: number;
    base?: number;
    surcharge?: number;
    pricing_method?: string;
    review_reason?: string;
  };
  assigned_nurse?: string;
  address_status: string;
  schedule_status: string;
  schedule?: { time: string; item: string; note?: string }[];
  payment_deadline?: string;
  order_type?: string;
  package_id?: string;
  refund_status?: string;
  refund_amount?: number;
  remote_tier?: string;
  nurse_pay_total?: number;
  payment_amount?: number;
  amount_paid?: number;
  payment_review_status?: string;
  services?: {
    id?: string;
    label: string;
    times: string[];
    prn: boolean;
    doctor_order_required?: boolean;
    replace_only?: boolean;
  }[];
};
type Email = {
  id: string;
  case_id: string;
  template_id: string;
  template_version: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  error?: string;
  links: { label: string; url: string }[];
};
type Event = {
  id: string;
  at: string;
  case_id?: string;
  event: string;
  reason?: string;
  time_scale: number;
  actor?: string;
  actor_code?: string;
  auth_method?: string;
  env?: string;
  from_status?: string;
  to_status?: string;
  template_id?: string;
  template_version?: string;
  token_id?: string;
  detail_json?: string;
};
export type Workspace = {
  settings: {
    time_scale: number;
    nurse_day_rate: number | null;
    nurse_night_rate: number | null;
    [key: string]: unknown;
  };
  nurses: {
    id: string;
    status: string;
    email: string;
    name?: string;
    category?: string;
    registration?: string;
    verification_note?: string;
    verified_by?: string;
  }[];
  cases: Case[];
  emails: Email[];
  events: Event[];
  admin_email?: string;
  payment_submissions: {
    id: string;
    case_id: string;
    reference: string;
    amount: number;
    status: string;
    transferred_at: string;
  }[];
  payment_reconciliations: {
    id: string;
    case_id: string;
    amount: number;
    verified_by: string;
    bank_reference?: string;
    received_at?: string;
  }[];
  packages: {
    id: string;
    patient_ref: string;
    hours_total: number;
    hours_used: number;
    hours_reserved: number;
    status: string;
  }[];
  ledger_entries: {
    id: string;
    package_id: string;
    case_id: string;
    type: string;
    hours: number;
    available_after: number;
  }[];
  payouts: {
    id: string;
    case_id: string;
    nurse_id: string;
    total: number;
    status: string;
    bank_reference?: string;
    paid_at?: string;
    paid_by?: string;
  }[];
  evidence: {
    id: string;
    requirement: string;
    result: string;
    note: string;
    artifact: string;
  }[];
  evidence_requirements: string[];
  template_catalog: Record<string, { scope: string; description: string }>;
  remote_list: { place: string; tier: string; list_version: string }[];
  capabilities: {
    workspace?: string;
    email_delivery_enabled?: boolean;
    email_restricted?: boolean;
    email: string;
    payment: string;
    bank_transfer_configured: boolean;
    live_ai: boolean;
    clock_offset_ms?: number;
    server_now?: string;
    test_clock?: boolean;
    fps_configured?: boolean;
  };
};
const services = catalog;
const labels: Record<string, string> = {
  upload_doctor: "上載醫生指示文件",
  report_fps: "提交轉帳資料",
  accept_single: "接受單次報價",
  accept_package: "30 小時套餐",
  accept_existing_package: "使用現有套餐",
  arrived: "已到達",
  visit_done: "完成",
  drop: "我唔可以做",
  modify: "我想修改",
  decline: "取消預約",
  cancel: "取消預約",
  take_case: "我要做此個案",
  provide_unit: "填寫單位",
  confirm_reminder: "確認提醒",
};
const status: Record<string, string> = {
  QUOTED: "已報價",
  PENDING_PAY: "待付款",
  PAID: "已付款",
  POSTED: "已派單",
  MATCHED: "已配對",
  READY: "待服務",
  IN_SERVICE: "服務中",
  DONE: "已完成",
  REMATCH: "重新配對",
  FULL_REFUND: "待批核退款",
  EXPIRED: "報價失效",
  MANUAL: "待人工處理",
  PAY_TIMEOUT: "付款逾時",
  CANCELLED: "已取消",
  NO_DR_ORDER: "缺少醫生指示",
  NO_FIRST_INSERT: "不提供首次插喉",
};
export function AdminWorkspace({
  session,
  publicIntake = false,
  operational = false,
  section = "requests",
  initialCaseId = "",
}: {
  session: StaffSession | null;
  publicIntake?: boolean;
  operational?: boolean;
  section?: string;
  initialCaseId?: string;
}) {
  const { language } = useLocale();
  const zh = language === "zh-HK";
  const text = (a: string, b: string) => (zh ? a : b);
  const [key, setKey] = useState(
    () => sessionStorage.getItem("workflow-admin-key") || "",
  );
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const actionFeedbackRef = useRef<HTMLDivElement>(null);
  const [enquiryMode, setEnquiryMode] = useState<"conversation" | "form">(
    "conversation",
  );
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(initialCaseId);
  const [mailId, setMailId] = useState("");
  const [tab, setTab] = useState<
    "cases" | "inbox" | "events" | "ledger" | "acceptance"
  >(section === "ledger" ? "ledger" : "cases");
  const [config, setConfig] = useState({
    time_scale: 1,
    nurse_day_rate: "",
    nurse_night_rate: "",
    admin_email: operational ? "" : "admin@example.test",
    nurses: [] as Workspace["nurses"],
    policies: {
      package_offer_rule: "MANUAL",
      quote_expiry: false,
      repost: false,
      repeat_no_taker: false,
      unit_chase: false,
      pre_service_alerts: false,
      reminder_escalation: false,
      allow_arrival_completion: false,
      package_release: false,
      notify_others: false,
      notify_data_deletion: false,
    } as Record<string, boolean | string>,
  });
  const [form, setForm] = useState({
    surname: publicIntake || operational ? "" : "陳",
    email: publicIntake || operational ? "" : "family@example.test",
    phone: "",
    district: publicIntake || operational ? "" : "屯門",
    building: publicIntake || operational ? "" : "康樂大廈（虛構）",
    date:
      publicIntake || operational
        ? new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10)
        : "2026-11-10",
    shift: "DAY",
    start: "10:00",
    end: "14:00",
    doctor_order: "NA",
    existing_tube: "YES",
    remarks: "",
    other: "",
    fictional: false,
    consent: false,
    gender: publicIntake || operational ? "" : "M",
    age: publicIntake || operational ? "" : "78",
    weight_kg: publicIntake || operational ? "" : "65",
    height_cm: publicIntake || operational ? "" : "165",
    mobility: publicIntake || operational ? "" : "需人輔助",
    companion: publicIntake || operational ? "" : "YES",
    patient_ref: publicIntake || operational ? "" : "TEST-PATIENT-01",
    medical_history: "",
    recent_3m: [] as string[],
    existing_tubes: {} as Record<string, string>,
    doctor_order_file: "",
    intake_version: "v3",
  });
  const [additionalVisits, setAdditionalVisits] = useState<
    { date: string; shift: string; start: string; end: string }[]
  >([]);
  const [intakeReview, setIntakeReview] = useState(false);
  const [invalidField, setInvalidField] = useState<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
  >(null);
  const intakeError = useRef<HTMLParagraphElement>(null);
  const reviewError = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!error) return;
    const target = intakeReview ? reviewError.current : intakeError.current;
    target?.focus();
    target?.scrollIntoView({ block: "center" });
  }, [intakeReview, error]);
  const [receipt, setReceipt] = useState<{
    id: string;
    status: string;
    quote?: { total: number };
  } | null>(null);
  const [items, setItems] = useState<Service[]>(
    operational ? [] : [{ ...services[0], times: ["12:00"], prn: false }],
  );
  async function request(path: string, body?: unknown) {
    let res: Response;
    try {
      res = await fetch(apiUrl(path), {
        method: body === undefined ? "GET" : "POST",
        signal: AbortSignal.timeout(40000),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(session?.csrf ? { "X-CSRF-Token": session.csrf } : {}),
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error(
        text(
          "未能連接伺服器，無法確認操作結果。如已提交查詢，請先向同事確認，避免重複提交。",
          "Could not reach the server or confirm the result. If you submitted an enquiry, check with staff before submitting again.",
        ),
      );
    }
    const data = await res.json().catch(() => null);
    if (!data)
      throw new Error(
        text(
          "伺服器暫時未能確認操作結果。如已提交查詢，請先向同事確認，避免重複提交。",
          "The server could not confirm the result. If you submitted an enquiry, check with staff before submitting again.",
        ),
      );
    if (!res.ok) {
      if (res.status === 401 && session?.method === "google")
        window.dispatchEvent(new Event("staff-session-expired"));
      throw new Error(data.error || "Request failed");
    }
    return data;
  }
  async function refresh(initial = false) {
    const data: Workspace = await request("/api/workflow");
    if (operational && !initial)
      window.dispatchEvent(new Event("staff-workflow-updated"));
    setWorkspace(data);
    if (initial)
      setConfig({
        time_scale: data.settings.time_scale,
        nurse_day_rate: String(data.settings.nurse_day_rate ?? ""),
        nurse_night_rate: String(data.settings.nurse_night_rate ?? ""),
        admin_email:
          data.admin_email || (operational ? "" : "admin@example.test"),
        nurses: data.nurses || [],
        policies: Object.fromEntries(
          Object.keys(config.policies).map((k) => [
            k,
            (data.settings[k] ?? config.policies[k]) as string | boolean,
          ]),
        ),
      });
    return data;
  }
  async function run(
    fn: () => Promise<unknown>,
    feedback?: { pending: string; success: string },
  ) {
    setBusy(true);
    setError("");
    setActionFeedback(feedback?.pending || "");
    try {
      await fn();
      if (!publicIntake) {
        await refresh();
        if (operational)
          window.dispatchEvent(new Event("staff-workflow-updated"));
      }
      if (feedback) setActionFeedback(feedback.success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!busy && actionFeedback) {
      actionFeedbackRef.current?.focus();
      actionFeedbackRef.current?.scrollIntoView({ block: "center" });
    }
  }, [busy, actionFeedback, error]);
  useEffect(() => {
    if (publicIntake) return;
    void refresh(true).catch((e) => setError(e.message));
    if (!operational) return;
    const reload = () => {
      if (document.visibilityState === "visible")
        void refresh().catch((e) => setError(e.message));
    };
    const timer = window.setInterval(reload, 30000);
    window.addEventListener("focus", reload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", reload);
    };
  }, []);
  const c =
    workspace?.cases.find((c) => c.id === selected) || workspace?.cases.at(-1);
  const emails =
    workspace?.emails
      .filter((m) => !selected || m.case_id === selected)
      .slice()
      .reverse() || [];
  const mail = emails.find((m) => m.id === mailId) || emails[0];
  function exportEvidence() {
    if (!workspace) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            timezone: "Asia/Hong_Kong",
            notice: operational
              ? "職員工作區匯出紀錄"
              : "流程紀錄，並非 TRL 認證或驗收合格報告",
            ...workspace,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = operational
      ? "careknock-workspace.json"
      : "trl3-email-evidence.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const [adminReason, setAdminReason] = useState("");
  const [redFlagResolution, setRedFlagResolution] = useState("");
  const [redFlagConfirmed, setRedFlagConfirmed] = useState(false);
  const [manualNightQuote, setManualNightQuote] = useState(false);
  const [manualNightBase, setManualNightBase] = useState("");
  const [manualNightSurcharge, setManualNightSurcharge] = useState("");
  const [manualNightConfirmed, setManualNightConfirmed] = useState(false);
  const validManualNightAmounts =
    /^\d+$/.test(manualNightBase) &&
    /^\d+$/.test(manualNightSurcharge) &&
    Number.isSafeInteger(
      Number(manualNightBase) + Number(manualNightSurcharge),
    ) &&
    Number(manualNightBase) + Number(manualNightSurcharge) > 0;
  const quoteBlockers = [
    ...(c?.intake_channel === "conversation"
      ? [
          text(
            "請先核實文字查詢，並另建完整服務安排後報價。",
            "Verify the text enquiry and create a complete service request before quoting.",
          ),
        ]
      : []),
    ...(c && c.status !== "MANUAL"
      ? [
          text(
            "此個案目前不是待人工處理狀態，不能在此重新發報價。",
            "This case is not awaiting manual review and cannot be quoted here.",
          ),
        ]
      : []),
    ...(c?.remote_tier === "UNMATCHED"
      ? [
          text(
            "地點覆核尚未儲存：核實地址、選擇偏遠分類，再按「覆核地點及交通津貼」。只更改選單不會儲存。",
            "Location review is not saved: verify the address, select the remote tier, then click Review location / allowance. Changing the selection alone does not save it.",
          ),
        ]
      : []),
    ...(!adminReason.trim()
      ? [
          text(
            "請填寫上方「覆核／操作原因」。",
            "Enter the review / action reason above.",
          ),
        ]
      : []),
    ...(manualNightQuote && !validManualNightAmounts
      ? [
          text(
            "請填寫人工基本費及附加費，均須為非負整數；無附加費請填 0，總額須大於 0。",
            "Enter whole-dollar manual base and surcharge amounts, both zero or more. Enter 0 for no surcharge; the total must be greater than 0.",
          ),
        ]
      : []),
    ...(manualNightQuote && adminReason.trim().length < 10
      ? [
          text(
            "人工夜更報價須在「覆核／操作原因」填寫至少 10 字收費依據。",
            "For a manual night quote, enter at least 10 characters explaining the pricing in the review / action reason.",
          ),
        ]
      : []),
    ...(manualNightQuote && !manualNightConfirmed
      ? [
          text(
            "請核對總額，並勾選「我已核實此夜更的基本費、附加費及總額」。修改金額後須重新勾選。",
            "Review the total and tick the confirmation that the night's base fee, surcharge and total have been verified. Confirm again after changing an amount.",
          ),
        ]
      : []),
  ];
  useEffect(() => {
    setRedFlagResolution("");
    setRedFlagConfirmed(false);
    setManualNightQuote(false);
    setManualNightBase("");
    setManualNightSurcharge("");
    setManualNightConfirmed(false);
    setAdminReason("");
  }, [c?.id]);
  const [fps, setFps] = useState({
    submission_id: "",
    bank_reference: "",
    amount: "",
    received_at: "",
    verified: false,
  });
  const [paymentNote, setPaymentNote] = useState("");
  const pendingReports =
    workspace?.payment_submissions.filter(
      (s) => s.case_id === c?.id && s.status === "PENDING_REVIEW",
    ) || [];
  const refundEntry =
    c?.status === "FULL_REFUND" && c.refund_status === "APPROVED";
  const canReconcile = c?.status === "PENDING_PAY" && pendingReports.length > 0;
  const validBankRecord =
    fps.verified &&
    fps.bank_reference.trim().length > 0 &&
    fps.bank_reference.trim().length <= 100 &&
    Number(fps.amount) > 0 &&
    Number(fps.amount) ===
      (refundEntry
        ? c?.refund_amount
        : (c?.payment_amount ?? c?.quote?.total)) &&
    !!fps.received_at &&
    !!paymentNote.trim();
  useEffect(() => {
    setFps({
      submission_id: "",
      bank_reference: "",
      amount: "",
      received_at: "",
      verified: false,
    });
    setPaymentNote("");
  }, [c?.id, c?.status, c?.refund_status]);
  async function fpsAction(action: string) {
    if (c)
      await request("/api/case-action", {
        id: c.id,
        action,
        ...fps,
        amount: Number(fps.amount),
        received_at: fps.received_at
          ? new Date(fps.received_at + "+08:00").toISOString()
          : "",
        reason: paymentNote,
      });
  }

  const [payoutForm, setPayoutForm] = useState({
    id: "",
    amount: "",
    bank_reference: "",
    paid_at: "",
    note: "",
    verified: false,
  });
  const [remoteTier, setRemoteTier] = useState("C");
  useEffect(() => {
    setRemoteTier(
      ["A", "B", "C"].includes(c?.remote_tier || "") ? c!.remote_tier! : "C",
    );
  }, [c?.id, c?.remote_tier]);
  const [scheduleEdit, setScheduleEdit] = useState("");
  const [correctedOrder, setCorrectedOrder] = useState("UNSURE");
  const [correctedTubes, setCorrectedTubes] = useState<Record<string, string>>(
    {},
  );
  const [clockTo, setClockTo] = useState("");
  const [remoteImport, setRemoteImport] = useState("");
  const [evidenceForm, setEvidenceForm] = useState({
    requirement: "F01",
    result: "PENDING",
    note: "",
    artifact: "",
  });
  async function action(action: string) {
    if (c)
      await request("/api/case-action", {
        id: c.id,
        action,
        reason: adminReason,
        tier: remoteTier,
        red_flag_resolved: redFlagConfirmed,
        red_flag_resolution: redFlagResolution,
        ...(action === "issue_quote" && manualNightQuote
          ? {
              manual_night_quote: {
                base: manualNightBase.trim() ? Number(manualNightBase) : null,
                surcharge: manualNightSurcharge.trim()
                  ? Number(manualNightSurcharge)
                  : null,
                confirmed: manualNightConfirmed,
              },
            }
          : {}),
        ...(action === "correct_intake"
          ? { doctor_order: correctedOrder, existing_tubes: correctedTubes }
          : {}),
        ...(action === "schedule_edit"
          ? { schedule: JSON.parse(scheduleEdit) }
          : {}),
      });
  }
  function exportCSV() {
    if (!workspace) return;
    const rows = [
      [
        "event_id",
        "ts",
        "case_id",
        "event",
        "actor",
        "time_scale",
        "actor_code",
        "auth_method",
        "env",
        "from_status",
        "to_status",
        "template_id",
        "template_version",
        "token_id",
        "detail_json",
      ],
      ...workspace.events.map((e) => [
        e.id,
        e.at,
        e.case_id || "",
        e.event,
        e.actor || "system",
        e.time_scale,
        e.actor_code || "",
        e.auth_method || "",
        e.env || "",
        e.from_status || "",
        e.to_status || "",
        e.template_id || "",
        e.template_version || "",
        e.token_id || "",
        e.detail_json || "",
      ]),
    ];
    const blob = new Blob(
      [
        "\uFEFF" +
          rows
            .map((r) =>
              r
                .map(
                  (v) =>
                    '"' +
                    (/^[=+@\-\t\r]/.test(String(v))
                      ? "'" + String(v)
                      : String(v)
                    ).replaceAll('"', '""') +
                    '"',
                )
                .join(","),
            )
            .join("\r\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trl3-event-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const reviewDialog = intakeReview && (
    <div className="ev-review-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={text("查詢資料確認", "Review enquiry details")}
        className="panel ev-panel ev-review"
      >
        <h2>
          {text("請核對資料後確認提交", "Review details before submission")}
        </h2>
        <p>
          {!publicIntake && `${form.patient_ref} · `}
          {form.surname} · {form.gender} · {form.age} 歲
          <br />
          {form.email} · {form.phone || "—"}
          <br />
          {form.district} {form.building}
          <br />
          {form.date}{" "}
          {form.shift === "DAY"
            ? `${form.start}–${form.end}`
            : form.shift === "NIGHT10"
              ? text("22:00–翌日 08:00", "22:00–08:00 next day")
              : text("22:00–翌日 10:00", "22:00–10:00 next day")}
        </p>
        {additionalVisits.length > 0 && (
          <pre>
            {additionalVisits
              .map(
                (v) =>
                  `${v.date} ${v.start}–${v.shift !== "DAY" ? text("翌日 ", "next day ") : ""}${v.end}`,
              )
              .join("\n")}
          </pre>
        )}
        <pre>
          {items
            .map(
              (s) =>
                `${s.label} ${s.prn ? text("護士自行安排", "Nurse to arrange") : s.times.join("、") || "待補時間"}`,
            )
            .join("\n")}
        </pre>
        <p>
          {text(
            "提交後將由伺服器執行驗證、人工分流及報價。",
            "Server validation, manual routing and quoting follow submission.",
          )}
        </p>
        {error && (
          <p ref={reviewError} role="alert" tabIndex={-1} className="ev-error">
            {error}
          </p>
        )}
        {busy && (
          <p role="status">
            {text(
              "正在提交查詢，請稍候…",
              "Submitting your enquiry, please wait…",
            )}
          </p>
        )}
        <div className="ev-actions">
          <button
            autoFocus
            className="button secondary"
            disabled={busy}
            onClick={() => setIntakeReview(false)}
          >
            {text("返回修改", "Back to edit")}
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await request(
                  publicIntake ? "/api/enquiries" : "/api/cases",
                  {
                    ...form,
                    ...(publicIntake
                      ? { patient_ref: form.surname.trim() }
                      : {}),
                    ...(publicIntake || operational
                      ? { fictional: undefined }
                      : {}),
                    services: items.map((item) => ({
                      ...item,
                      times: item.prn ? [] : item.times,
                    })),
                    ...(additionalVisits.length
                      ? {
                          visits: [
                            {
                              date: form.date,
                              shift: form.shift,
                              start:
                                form.shift === "DAY" ? form.start : "22:00",
                              end:
                                form.shift === "DAY"
                                  ? form.end
                                  : form.shift === "NIGHT10"
                                    ? "08:00"
                                    : "10:00",
                            },
                            ...additionalVisits,
                          ],
                        }
                      : {}),
                  },
                );
                if (publicIntake) setReceipt(result);
                else setSelected(result.id);
                setIntakeReview(false);
                if (operational)
                  window.location.hash = `staff/requests/${result.id}`;
              })
            }
          >
            {busy
              ? text("提交中…", "Submitting…")
              : text("確認提交查詢", "Confirm enquiry submission")}
          </button>
        </div>
      </section>
    </div>
  );
  const intakePanel = (
    <section className="panel ev-panel">
      <h2>
        {publicIntake
          ? text("提交護理查詢", "Submit a care enquiry")
          : operational
            ? text("建立護理查詢", "Create a care enquiry")
            : text("1. 建立虛構查詢", "1. Create a fictional enquiry")}
      </h2>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const invalid = e.currentTarget.querySelector<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          >("input:invalid, select:invalid, textarea:invalid");
          if (invalid) {
            const label =
              invalid.labels?.[0]?.textContent?.trim() ||
              text("必填欄位", "Required field");
            const hint =
              invalid.type === "email"
                ? text("請輸入有效電郵地址。", "Enter a valid email address.")
                : invalid.getAttribute("pattern") === "[0-9]{8}"
                  ? text(
                      "請輸入 8 位數字，或留空。",
                      "Enter 8 digits or leave this blank.",
                    )
                  : invalid.type === "checkbox"
                    ? text("請勾選確認。", "Please tick this confirmation.")
                    : text(
                        "請填妥或更正此欄位。",
                        "Complete or correct this field.",
                      );
            setInvalidField(invalid);
            setError(`${label}：${hint}`);
            // Also focus on repeated attempts with the same validation message.
            intakeError.current?.focus();
            intakeError.current?.scrollIntoView({ block: "center" });
            return;
          }
          setInvalidField(null);
          if (!items.length) {
            setError(
              text(
                "請選擇至少一項護理服務。",
                "Select at least one care service.",
              ),
            );
            return;
          }
          const start = form.shift === "DAY" ? form.start : "22:00";
          const end =
            form.shift === "DAY"
              ? form.end
              : form.shift === "NIGHT10"
                ? "08:00"
                : "10:00";
          const invalidService = items.find(
            (item) =>
              !item.prn &&
              item.times.some((time) =>
                form.shift === "DAY"
                  ? time < start || time > end
                  : !(time >= start || time <= end),
              ),
          );
          if (invalidService) {
            setInvalidField(
              e.currentTarget.querySelector<HTMLSelectElement>(
                `[data-service-id="${invalidService.id}"] select`,
              ),
            );
            setError(
              text(
                `${invalidService.label}：偏好時間須在服務時段 ${start}–${form.shift !== "DAY" ? "翌日 " : ""}${end} 內，請重新選擇。`,
                `${invalidService.label}: choose preferred times within the service window ${start}–${form.shift !== "DAY" ? "next day " : ""}${end}.`,
              ),
            );
            return;
          }
          setError("");
          setIntakeReview(true);
        }}
      >
        <div className="ev-form-grid">
          {publicIntake ? (
            <label>
              {text("病人姓名", "Patient name")}
              <input
                required
                maxLength={80}
                autoComplete="off"
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
            </label>
          ) : (
            <label>
              {text(
                "病人代號（套餐只限同一病人）",
                "Patient reference (package owner)",
              )}
              <input
                required
                value={form.patient_ref}
                onChange={(e) =>
                  setForm({ ...form, patient_ref: e.target.value })
                }
              />
            </label>
          )}
          <label>
            {text("性別", "Gender")}
            <select
              required
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">{text("請選擇", "Select")}</option>
              <option value="M">男 / Male</option>
              <option value="F">女 / Female</option>
            </select>
          </label>
          {(["age", "weight_kg", "height_cm"] as const).map((k, i) => (
            <label key={k}>
              {
                [
                  text("年齡", "Age"),
                  text("體重 kg", "Weight kg"),
                  text("身高 cm", "Height cm"),
                ][i]
              }
              <input
                required
                type="number"
                min={k === "age" ? 0 : 1}
                max={k === "age" ? 120 : undefined}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <label>
            {text("行動能力", "Mobility")}
            <select
              required
              value={form.mobility}
              onChange={(e) => setForm({ ...form, mobility: e.target.value })}
            >
              <option value="">{text("請選擇", "Select")}</option>
              {["需人輔助", "臥床", "輪椅", "手推車", "行架", "可自行出門"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          <label>
            {text("服務時陪伴", "Companion during service")}
            <select
              required
              value={form.companion}
              onChange={(e) => setForm({ ...form, companion: e.target.value })}
            >
              <option value="">{text("請選擇", "Select")}</option>
              <option value="YES">有</option>
              <option value="NO">沒有</option>
              <option value="PARTIAL">部分時間</option>
            </select>
          </label>
          {!publicIntake && (
            <label>
              {text("病人姓名", "Patient name")}
              <input
                required
                maxLength={80}
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
            </label>
          )}
          <label>
            {text("電郵（必填）", "Email (required)")}
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            {text("電話（選填，8 位數字）", "Phone (optional, 8 digits)")}
            <input
              pattern="[0-9]{8}"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            {text("地區", "District")}
            <select
              required
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            >
              <option value="">{text("請選擇地區", "Select district")}</option>
              {[
                "中西區",
                "灣仔",
                "東區",
                "南區",
                "油尖旺",
                "深水埗",
                "九龍城",
                "黃大仙",
                "觀塘",
                "葵青",
                "荃灣",
                "屯門",
                "元朗",
                "北區",
                "大埔",
                "沙田",
                "西貢",
                "離島",
              ].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            {text("大廈（此步不收單位）", "Building (no unit at intake)")}
            <input
              required
              value={form.building}
              onChange={(e) => setForm({ ...form, building: e.target.value })}
            />
          </label>
          <label>
            {text("服務日期", "Service date")}
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label>
            {text("時段", "Shift")}
            <select
              value={form.shift}
              onChange={(e) => setForm({ ...form, shift: e.target.value })}
            >
              <option value="DAY">{text("日間", "Day")}</option>
              <option value="NIGHT10">
                {text(
                  "夜間 22:00–翌日 08:00（10 小時）",
                  "Night 22:00–08:00 next day (10 hours)",
                )}
              </option>
              <option value="NIGHT12">
                {text(
                  "夜間 22:00–翌日 10:00（12 小時）",
                  "Night 22:00–10:00 next day (12 hours)",
                )}
              </option>
            </select>
          </label>
          {form.shift === "DAY" && (
            <>
              <label>
                {text("開始", "Start")}
                <DayTimeSelect
                  value={form.start}
                  onChange={(start) =>
                    setForm({
                      ...form,
                      start,
                      end: form.end > start ? form.end : "",
                    })
                  }
                />
              </label>
              <label>
                {text("結束", "End")}
                <DayTimeSelect
                  end
                  after={form.start}
                  value={form.end}
                  onChange={(end) => setForm({ ...form, end })}
                />
              </label>
            </>
          )}
        </div>
        <p className="form-hint">
          {text(
            "以上時間均為香港時間，採用 24 小時制。日間可選 07:00–22:00，每半小時一格；結束時間須遲於開始時間。",
            "All times are in Hong Kong time using the 24-hour clock. Day visits run within 07:00–22:00 in 30-minute steps; the end must be later than the start.",
          )}
        </p>
        <details>
          <summary>
            {text("多次上門／日夜組合", "Additional visits / day and night")}
          </summary>
          <p>
            {text(
              "可記錄多段需求，由同事跟進；組合收費規則未確認，不會自動報價。",
              "Record each requested visit for staff follow-up. Combined pricing requires manual review.",
            )}
          </p>
          {additionalVisits.map((v, index) => (
            <div className="ev-grid" key={index}>
              <label>
                {text("服務日期", "Visit date")}
                <input
                  type="date"
                  required
                  value={v.date}
                  onChange={(e) =>
                    setAdditionalVisits(
                      additionalVisits.map((r, n) =>
                        n === index ? { ...r, date: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              <label>
                {text("時段", "Visit shift")}
                <select
                  value={v.shift}
                  onChange={(e) =>
                    setAdditionalVisits(
                      additionalVisits.map((r, n) =>
                        n === index
                          ? {
                              ...r,
                              shift: e.target.value,
                              start:
                                e.target.value === "DAY" ? "10:00" : "22:00",
                              end:
                                e.target.value === "DAY"
                                  ? "14:00"
                                  : e.target.value === "NIGHT10"
                                    ? "08:00"
                                    : "10:00",
                            }
                          : r,
                      ),
                    )
                  }
                >
                  <option value="DAY">{text("日間", "Day")}</option>
                  <option value="NIGHT10">
                    {text(
                      "夜間 22:00–翌日 08:00（10 小時）",
                      "Night 22:00–08:00 next day (10 hours)",
                    )}
                  </option>
                  <option value="NIGHT12">
                    {text(
                      "夜間 22:00–翌日 10:00（12 小時）",
                      "Night 22:00–10:00 next day (12 hours)",
                    )}
                  </option>
                </select>
              </label>
              {(["start", "end"] as const).map((field) => (
                <label key={field}>
                  {text(
                    field === "start" ? "開始" : "結束",
                    field === "start" ? "Visit start" : "Visit end",
                  )}
                  {v.shift !== "DAY" ? (
                    <span>
                      {field === "end" ? text("翌日 ", "Next day ") : ""}
                      {v[field]}
                    </span>
                  ) : (
                    <DayTimeSelect
                      end={field === "end"}
                      after={field === "end" ? v.start : undefined}
                      value={v[field]}
                      onChange={(value) =>
                        setAdditionalVisits(
                          additionalVisits.map((r, n) =>
                            n === index
                              ? {
                                  ...r,
                                  [field]: value,
                                  ...(field === "start" && r.end <= value
                                    ? { end: "" }
                                    : {}),
                                }
                              : r,
                          ),
                        )
                      }
                    />
                  )}
                </label>
              ))}
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  setAdditionalVisits(
                    additionalVisits.filter((_, n) => n !== index),
                  )
                }
              >
                {text("移除", "Remove")}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={additionalVisits.length >= 29}
            onClick={() =>
              setAdditionalVisits([
                ...additionalVisits,
                { date: form.date, shift: "DAY", start: "10:00", end: "14:00" },
              ])
            }
          >
            {text("加入上門時段", "Add visit")}
          </button>
        </details>
        <fieldset>
          <legend>
            {text(
              "護理項目及原有偏好時間",
              "Services and stated preferred times",
            )}
          </legend>
          {services.map((s) => {
            const chosen = items.find((x) => x.id === s.id);
            return (
              <div className="ev-service" data-service-id={s.id} key={s.id}>
                <label className="ev-check">
                  <input
                    type="checkbox"
                    checked={!!chosen}
                    onChange={(e) =>
                      setItems(
                        e.target.checked
                          ? [...items, { ...s, times: [], prn: false }]
                          : items.filter((x) => x.id !== s.id),
                      )
                    }
                  />
                  {s.label}
                </label>
                {chosen && (
                  <div>
                    <PreferredTimeFields
                      label={s.label}
                      times={chosen.times}
                      disabled={chosen.prn}
                      onChange={(times) =>
                        setItems(
                          items.map((x) =>
                            x.id === s.id
                              ? {
                                  ...x,
                                  times,
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    <label className="ev-check">
                      <input
                        type="checkbox"
                        checked={chosen.prn}
                        onChange={(e) =>
                          setItems(
                            items.map((x) =>
                              x.id === s.id
                                ? { ...x, prn: e.target.checked }
                                : x,
                            ),
                          )
                        }
                      />
                      {text("護士自行安排", "Nurse to arrange")}
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
        {items.some(
          (x) => catalog.find((s) => s.id === x.id)?.doctor_order_required,
        ) && (
          <div className="ev-form-grid">
            <label>
              {text("醫生指示", "Doctor order")}
              <select
                value={form.doctor_order}
                onChange={(e) =>
                  setForm({ ...form, doctor_order: e.target.value })
                }
              >
                <option value="NA">{text("請選擇", "Select")}</option>
                <option value="YES">{text("有", "Yes")}</option>
                <option value="NO">{text("沒有", "No")}</option>
                <option value="UNSURE">{text("不確定", "Unsure")}</option>
              </select>
            </label>
            <label>
              {text(
                "現有喉管（所有選取換喉項目）",
                "Existing tube (selected replacement services)",
              )}
              <select
                value={form.existing_tube}
                onChange={(e) =>
                  setForm({ ...form, existing_tube: e.target.value })
                }
              >
                <option value="YES">{text("已有", "Existing")}</option>
                <option value="NO_FIRST_INSERT">
                  {text("首次插入", "First insertion")}
                </option>
                <option value="UNSURE">{text("不確定", "Unsure")}</option>
              </select>
            </label>
          </div>
        )}
        {items
          .filter((x) => catalog.find((s) => s.id === x.id)?.replace_only)
          .map((x) => (
            <label key={x.id}>
              {x.label} · {text("現有喉管狀態", "Existing tube status")}
              <select
                value={form.existing_tubes[x.id] || form.existing_tube}
                onChange={(e) =>
                  setForm({
                    ...form,
                    existing_tubes: {
                      ...form.existing_tubes,
                      [x.id]: e.target.value,
                    },
                  })
                }
              >
                <option value="YES">已有 / Existing</option>
                <option value="NO_FIRST_INSERT">
                  首次插入 / First insertion
                </option>
                <option value="UNSURE">不確定 / Unsure</option>
              </select>
            </label>
          ))}
        <label>
          {publicIntake
            ? text(
                "醫生指示文件代號（如有）",
                "Doctor-order reference (if available)",
              )
            : text(
                "醫生指示樣本文件代號（只用虛構樣本）",
                "Doctor order sample reference (fictional)",
              )}
          <input
            value={form.doctor_order_file}
            onChange={(e) =>
              setForm({ ...form, doctor_order_file: e.target.value })
            }
          />
        </label>
        <label>
          {text("病史", "Medical history")}
          <textarea
            value={form.medical_history}
            onChange={(e) =>
              setForm({ ...form, medical_history: e.target.value })
            }
          />
        </label>
        <fieldset>
          <legend>{text("近三個月情況", "Recent three months")}</legend>
          {[
            "嚴重疾病",
            "跌倒／頭暈／失去平衡",
            "進食／吞嚥困難",
            "疼痛",
            "壓瘡／手術傷口",
            "以上皆無",
          ].map((v) => (
            <label key={v} className="ev-check">
              <input
                type="checkbox"
                checked={form.recent_3m.includes(v)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    recent_3m: e.target.checked
                      ? [...form.recent_3m, v]
                      : form.recent_3m.filter((x) => x !== v),
                  })
                }
              />
              {v}
            </label>
          ))}
        </fieldset>
        <label>
          {text(
            "補充（紅旗或臨床判斷請求會交人手）",
            "Remarks (clinical requests route to manual review)",
          )}
          <textarea
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          />
        </label>
        <label>
          {text("其他護理需要（交人手）", "Other needs (manual review)")}
          <input
            value={form.other}
            onChange={(e) => setForm({ ...form, other: e.target.value })}
          />
        </label>
        <label className="ev-check">
          <input
            required
            type="checkbox"
            checked={
              publicIntake || operational ? form.consent : form.fictional
            }
            onChange={(e) =>
              setForm({
                ...form,
                ...(publicIntake || operational
                  ? { consent: e.target.checked }
                  : { fictional: e.target.checked }),
              })
            }
          />
          {publicIntake || operational
            ? text(
                "我同意將以上資料保存，用於跟進查詢、報價及安排服務。",
                "I agree that this information may be stored and used to follow up my enquiry, quote and arrange care.",
              )
            : text(
                "我確認以上全部為虛構資料，同意將地區、大廈及所選護理項目發送至測試護士。",
                "All data is fictional; I agree to share district, building and chosen services with test nurses.",
              )}
        </label>
        <p className="form-hint">
          {publicIntake || operational
            ? text(
                "查詢會儲存在伺服器，由同事核實服務需要及地點後跟進。確認報價及收款後才安排派單。",
                "Your enquiry is stored on the server. Staff review your care needs and location before following up. Dispatch follows quote acceptance and verified payment.",
              )
            : text(
                "完整實驗表格。偏遠名單未配對時交管理員覆核；未確認政策以實驗設定控制。",
                "Complete experimental intake. Unmatched remote locations require administrator review. Unconfirmed policies are explicit experiment settings.",
              )}
        </p>
        <button
          className="button primary"
          disabled={busy || (!publicIntake && !workspace)}
          type="submit"
        >
          {text("確認資料並提交", "Confirm details and submit")}
          <ArrowRight size={16} />
        </button>
      </form>
    </section>
  );
  if (publicIntake)
    return (
      <div className="email-validation ev-public">
        <LanguageSwitcher />
        <div className="ev-heading">
          <div>
            <p className="eyebrow">CareKnock</p>
            <h1>{text("上門護理查詢", "Home nursing enquiry")}</h1>
            <p>
              {text(
                "先說說病人狀況，讓 AI 協助整理；你亦可選擇填寫表格。同事會透過電郵跟進查詢。",
                "Start with the patient's situation and let AI help organise your enquiry, or choose the form. Staff will follow up by email.",
              )}
            </p>
          </div>
        </div>
        <div
          className="conversation-mode-switch"
          role="group"
          aria-label={text("查詢方式", "Enquiry method")}
        >
          <button
            className="button"
            aria-pressed={enquiryMode === "conversation"}
            onClick={() => setEnquiryMode("conversation")}
          >
            {text("文字／AI 查詢", "Describe with AI")}
          </button>
          <button
            className="button"
            aria-pressed={enquiryMode === "form"}
            onClick={() => setEnquiryMode("form")}
          >
            {text("填寫表格", "Use enquiry form")}
          </button>
        </div>
        <div hidden={enquiryMode !== "conversation"}>
          <ConversationEnquiry />
        </div>
        <div hidden={enquiryMode !== "form"}>
          <section className="panel ev-panel">
            <h2>{text("收費及安排", "Pricing and arrangements")}</h2>
            <p>
              {text(
                "日間 07:00–22:00：HK$305／小時，最低四小時；夜間 22:00–翌日08:00／10:00：HK$325／小時，固定10／12小時。星期日及公眾假期另加 HK$30／小時；跨日假期組合及未定規則交人手。",
                "Day 07:00–22:00: HK$305/hour, four-hour minimum. Night 22:00–08:00/10:00: HK$325/hour, fixed 10/12 hours. Sundays and public holidays add HK$30/hour; unresolved cross-day rules require manual review.",
              )}
            </p>
            <p>
              {text(
                "30 小時日間套餐 HK$8,650，適用條件由同事核實。工具物料由客人自備；偏遠地區不另向客人收費。確認報價後24小時付款；≥24小時取消免費，少於24小時及改期交人手。付款指示會透過電郵另行提供，提交轉帳資料後須由同事核對入帳。",
                "30-hour day package HK$8,650, subject to staff confirmation of eligibility. Customers supply materials; remote locations do not add customer fees. Payment is due within 24 hours of quote acceptance. Cancellation at least 24 hours ahead is free; shorter notice and rescheduling require manual handling. Payment instructions are sent separately by email; staff verify the bank receipt after you submit transfer details.",
              )}
            </p>
          </section>
          {error && !intakeReview && (
            <p
              ref={intakeError}
              role="alert"
              tabIndex={-1}
              className="ev-error"
            >
              {error}
              {invalidField && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    invalidField.focus();
                    invalidField.scrollIntoView({ block: "center" });
                  }}
                >
                  {text("前往需要修改的欄位", "Go to the field to correct")}
                </button>
              )}
            </p>
          )}
          {receipt ? (
            <section className="panel ev-panel" role="status">
              <h2>
                {text("已收到查詢", "Enquiry received")} · {receipt.id}
              </h2>
              <p>
                {text(
                  "請留意電郵；需要核實嘅資料由同事跟進。收到報價後，請開啟電郵內連結並在確認頁操作。",
                  "Check your email. Staff will follow up any details requiring review. Open the quote email link and use the confirmation page.",
                )}
              </p>
              {receipt.quote && (
                <p>
                  {text("報價總額", "Quoted total")}: HK$ {receipt.quote.total}
                </p>
              )}
              <button
                className="button secondary"
                onClick={() => {
                  setReceipt(null);
                  setForm({ ...form, fictional: false, consent: false });
                }}
              >
                {text("提交另一個查詢", "Submit another enquiry")}
              </button>
            </section>
          ) : (
            intakePanel
          )}
          {reviewDialog}
        </div>
        <a className="conversation-home-link" href="/">
          {text("返回主頁", "Back to home")}
        </a>
      </div>
    );

  return (
    <div className="email-validation">
      {!operational && (
        <div className="ev-heading">
          <div>
            <p className="eyebrow">TRL 3 · EMAIL PROOF OF CONCEPT</p>
            <h1>{text("電郵流程驗證台", "Email validation workspace")}</h1>
            <p>
              {text(
                "用虛構個案驗證關鍵流程，保留可追查證據。TRL 3 達標狀態仍待實驗及審核。",
                "Validate the workflow with fictional cases and traceable evidence. TRL 3 achievement remains subject to testing and review.",
              )}
            </p>
          </div>
          <FlaskConical size={35} />
        </div>
      )}
      {!!workspace?.capabilities.clock_offset_ms && (
        <p className="ev-error">
          {text(
            "虛擬時鐘實驗：並非真實經過時間",
            "VIRTUAL CLOCK EXPERIMENT: not elapsed wall time",
          )}{" "}
          · {workspace.capabilities.server_now}
        </p>
      )}
      {(!operational || section === "settings") && (
        <div className="ev-capabilities">
          <span>
            <Mail size={16} />
            {["smtp", "smtp_test"].includes(workspace?.capabilities.email || "")
              ? operational
                ? text("SMTP 寄信", "SMTP delivery")
                : text("SMTP 測試寄信（白名單）", "SMTP test / allowlist")
              : operational
                ? text("寄信尚未啟用", "Email delivery not enabled")
                : text("本機測試收件箱", "Local test inbox")}
          </span>
          <span>
            {workspace?.capabilities.payment === "bank_transfer"
              ? text(
                  "銀行轉帳 · 同事人手核對入帳",
                  "Bank transfer · manual bank verification",
                )
              : workspace?.capabilities.payment === "fps_test"
                ? text(
                    "FPS 轉帳 · 管理員人手對數（測試）",
                    "FPS · administrator reconciliation (test)",
                  )
                : workspace?.capabilities.payment === "stripe_test"
                  ? "Stripe test mode"
                  : text(
                      "本機模擬付款 · 未連接 Stripe",
                      "Local mock payment · Stripe not connected",
                    )}
          </span>
          <span>
            {text("規則產生草稿 · 未連接 AI", "Rules draft · no live AI")}
          </span>
          <span>{text("伺服器 SQLite 儲存", "Server SQLite storage")}</span>
        </div>
      )}
      {(!operational || section === "settings") && (
        <details className="panel ev-config" open={operational}>
          <summary>
            <LockKeyhole size={16} />{" "}
            {operational
              ? text("服務設定", "Service settings")
              : text(
                  "測試設定及管理員連線",
                  "Test settings and admin connection",
                )}
          </summary>
          <p>
            {text(
              operational
                ? "請確認護士薪酬及跟進電郵。有進行中個案時，計價及流程設定會鎖定。護士資料請到護理人員頁管理。"
                : "全部測試收件人必須由團隊控制。護士薪酬未確認，請先輸入本次實驗值；有進行中個案時設定會鎖定。",
              operational
                ? "Confirm nurse rates and the follow-up email. Pricing and workflow settings lock while cases are active. Manage nurses on the provider page."
                : "Use team-controlled test recipients. Confirm experimental nurse rates before dispatch. Settings lock while cases are active.",
            )}
          </p>
          {!operational && (
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setConfig({
                  ...config,
                  policies: Object.fromEntries(
                    Object.keys(config.policies).map((k) => [
                      k,
                      k === "package_offer_rule" ? "WEEKDAY_DAY_LE30" : true,
                    ]),
                  ),
                })
              }
            >
              {text(
                "選取完整實驗組合（仍須確認儲存）",
                "Select full experiment policies (save to confirm)",
              )}
            </button>
          )}
          <div className="ev-form-grid">
            {!session && !operational && (
              <label>
                {text("管理員金鑰", "Admin key")}
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
            {!session && !operational && (
              <button
                disabled={busy}
                className="button secondary"
                onClick={() =>
                  run(async () => {
                    sessionStorage.setItem("workflow-admin-key", key);
                    await refresh(true);
                  })
                }
              >
                {text("連線", "Connect")}
              </button>
            )}
            <label>
              {text("計時倍率", "Time scale")}
              <select
                value={config.time_scale}
                onChange={(e) =>
                  setConfig({ ...config, time_scale: Number(e.target.value) })
                }
              >
                <option value={1}>1 · {text("真實時間", "Real time")}</option>
                <option
                  value={60}
                  disabled={
                    operational ||
                    workspace?.capabilities.payment === "bank_transfer" ||
                    workspace?.capabilities.payment === "stripe_test"
                  }
                >
                  60 ·{" "}
                  {text(
                    "一小時當一分鐘（只限虛構實驗）",
                    "1 hour = 1 minute (fictional experiment)",
                  )}
                </option>
              </select>
            </label>
            <label>
              {operational
                ? text("日間護士時薪 HKD", "Day nurse rate HKD")
                : text("日間護士時薪（測試值）", "Day nurse rate (test)")}
              <input
                type="number"
                min="1"
                value={config.nurse_day_rate}
                onChange={(e) =>
                  setConfig({ ...config, nurse_day_rate: e.target.value })
                }
              />
            </label>
            <label>
              {operational
                ? text("夜間護士時薪 HKD", "Night nurse rate HKD")
                : text("夜間護士時薪（測試值）", "Night nurse rate (test)")}
              <input
                type="number"
                min="1"
                value={config.nurse_night_rate}
                onChange={(e) =>
                  setConfig({ ...config, nurse_night_rate: e.target.value })
                }
              />
            </label>
            <label>
              {text("管理員電郵", "Admin email")}
              <input
                type="email"
                value={config.admin_email}
                onChange={(e) =>
                  setConfig({ ...config, admin_email: e.target.value })
                }
              />
            </label>
            {operational && !workspace?.admin_email && (
              <p className="ev-error" role="status">
                {text(
                  "尚未設定管理員通知電郵。通知會保留在系統，但不會寄出；請填寫真實電郵並儲存設定。",
                  "Admin notification email is not configured. Notifications are saved but will not be delivered. Enter a real email and save settings.",
                )}
              </p>
            )}
            {Object.entries(config.policies).map(([k, v]) => (
              <label
                className={typeof v === "boolean" ? "ev-check" : ""}
                key={k}
              >
                {typeof v === "boolean" ? (
                  <>
                    <input
                      type="checkbox"
                      checked={v}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          policies: {
                            ...config.policies,
                            [k]: e.target.checked,
                          },
                        })
                      }
                    />
                    {(
                      {
                        quote_expiry: "報價提醒及失效",
                        repost: "24h 無人重發",
                        repeat_no_taker: "之後每 24h 只警示管理員",
                        unit_chase: "12h 追問單位",
                        pre_service_alerts: "服務前資料檢查及無人警示",
                        reminder_escalation: "追問後 15 分鐘警示管理員",
                        allow_arrival_completion: "到達／完成確認",
                        package_release: "套餐取消釋放預留時數",
                        notify_others: "通知其他護士已接單",
                        notify_data_deletion: "放飛／取消後要求刪除客人資料",
                      } as Record<string, string>
                    )[k] || k}
                  </>
                ) : (
                  <>
                    {operational
                      ? text("套餐顯示規則", "Package offer rules")
                      : text(
                          "套餐顯示（實驗政策）",
                          "Package offer (experiment)",
                        )}
                    <select
                      value={String(v)}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          policies: { ...config.policies, [k]: e.target.value },
                        })
                      }
                    >
                      <option value="MANUAL">
                        MANUAL · {text("預設交人手", "Manual default")}
                      </option>
                      <option value="WEEKDAY_DAY_LE30">
                        {text("平日日間 ≤30h 顯示套餐", "Weekday day ≤30h")}
                      </option>
                    </select>
                  </>
                )}
              </label>
            ))}
            {!operational &&
              config.nurses.map((n) => (
                <label key={n.id}>
                  {n.id} · {n.status}
                  <input
                    type="email"
                    value={n.email}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        nurses: config.nurses.map((x) =>
                          x.id === n.id ? { ...x, email: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
              ))}
          </div>
          <button
            className="button primary"
            disabled={busy || !workspace}
            onClick={() => run(() => request("/api/settings", config))}
          >
            {operational
              ? text("儲存服務設定", "Save service settings")
              : text("確認並儲存測試設定", "Confirm test settings")}
          </button>
        </details>
      )}
      <div className="ev-toolbar">
        {!operational && (
          <div role="tablist">
            {(
              ["cases", "inbox", "events", "ledger", "acceptance"] as const
            ).map((t, i) => (
              <button
                role="tab"
                aria-selected={tab === t}
                key={t}
                onClick={() => setTab(t)}
              >
                {
                  [
                    text("個案流程", "Cases"),
                    text("測試收件箱", "Test inbox"),
                    text("事件證據", "Evidence"),
                    text("套餐及出糧帳", "Ledgers"),
                    text("驗收清單", "Acceptance"),
                  ][i]
                }{" "}
                {t === "inbox" ? `(${workspace?.emails.length || 0})` : ""}
              </button>
            ))}
          </div>
        )}
        {!operational && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => run(() => refresh())}
          >
            <RefreshCw size={15} />
            {text("重新整理", "Refresh")}
          </button>
        )}
        <button
          className="button secondary"
          onClick={exportEvidence}
          disabled={!workspace}
        >
          <Download size={15} />
          {operational
            ? text("匯出紀錄", "Export records")
            : text("匯出證據", "Export evidence")}
        </button>
      </div>
      {error && !actionFeedback && (
        <div className="ev-error" role="alert">
          {error}
        </div>
      )}
      {(!operational || section === "requests") && (
        <label className="ev-case-select">
          {text("查看個案", "View case")}
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              if (operational)
                window.location.hash = `staff/requests/${e.target.value}`;
              setMailId("");
            }}
          >
            <option value="">
              {text("全部／最新個案", "All / latest case")}
            </option>
            {workspace?.cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {caseStatusLabel(c.status, zh)}
              </option>
            ))}
          </select>
        </label>
      )}
      {reviewDialog}
      {tab === "cases" &&
        (!operational || ["requests", "enquiries"].includes(section)) && (
          <div className="ev-columns">
            {(!operational || section === "enquiries") && intakePanel}
            {(!operational || section === "requests") && (
              <section className="panel ev-panel ev-case-panel" key={c?.id}>
                <h2>
                  {operational
                    ? text("個案處理", "Case management")
                    : text("2. 驗證個案流程", "2. Validate the case flow")}
                </h2>
                {c ? (
                  <>
                    <CaseOverview
                      c={c}
                      zh={zh}
                      pendingReports={pendingReports.length}
                    />
                    {c.visits && c.visits.length > 1 && (
                      <details className="ev-admin">
                        <summary>
                          {text("查看全部服務日期", "View all visit dates")}
                        </summary>
                        <pre>
                          {c.visits
                            .map(
                              (v) =>
                                `${v.date} ${v.start}–${v.end}${v.end < v.start ? text("（翌日）", " (+1 day)") : ""}`,
                            )
                            .join("\n")}
                        </pre>
                      </details>
                    )}
                    {c.intake_channel === "conversation" && (
                      <section className="conversation-summary">
                        <h3>
                          {text(
                            "文字護理查詢（待核實）",
                            "Care enquiry (verification pending)",
                          )}
                        </h3>
                        {c.enquiry_summary && <p>{c.enquiry_summary}</p>}
                        <p>
                          {text("期望時間", "Preferred timing")}:{" "}
                          {c.preferred_timing || text("待確認", "To confirm")}
                        </p>
                        <h4>
                          {text("家屬原文", "Family's original description")}
                        </h4>
                        <p style={{ whiteSpace: "pre-wrap" }}>{c.remarks}</p>
                        <p>
                          {text(
                            "請先與家屬核實，另建完整服務安排後才可報價。",
                            "Follow up with the family and create a complete service request before quoting.",
                          )}
                        </p>
                      </section>
                    )}
                    {c.quote?.pricing_method === "MANUAL_NIGHT_HOLIDAY" && (
                      <p>
                        {text("人工夜更報價", "Manually reviewed night quote")}{" "}
                        · {text("基本費", "Base fee")} HK${c.quote.base} ·{" "}
                        {text("附加費", "Surcharge")} HK${c.quote.surcharge}
                        <br />
                        {text("覆核原因", "Review reason")}:{" "}
                        {c.quote.review_reason}
                      </p>
                    )}
                    {["bank_transfer", "fps_test"].includes(
                      workspace?.capabilities.payment || "",
                    ) && (
                      <section
                        className="ev-finance"
                        aria-label={text("收款及退款", "Payments and refunds")}
                      >
                        <div className="ev-finance-heading">
                          <h3>
                            {refundEntry
                              ? text("記錄銀行退款", "Record bank refund")
                              : text("收款對數", "Payment reconciliation")}
                          </h3>
                          <span className="ev-finance-status">
                            {refundEntry
                              ? refundStatusLabel(c.refund_status, zh)
                              : {
                                  PENDING_REVIEW: text(
                                    "待核對銀行入帳",
                                    "Awaiting bank verification",
                                  ),
                                  VERIFIED: text(
                                    "已核實收款",
                                    "Payment verified",
                                  ),
                                  REJECTED: text(
                                    "資料不符，待跟進",
                                    "Report rejected, follow up",
                                  ),
                                }[c.payment_review_status || ""] ||
                                text("未有收款紀錄", "No payment recorded")}
                          </span>
                        </div>
                        {canReconcile || refundEntry ? (
                          <>
                            <p className="ev-finance-help">
                              {workspace?.capabilities.payment ===
                              "bank_transfer"
                                ? text(
                                    "客人提交資料後，請登入銀行核對實際入帳；確認收款前不會派單。系統不會自動查銀行或轉帳。",
                                    "Check the actual receipt in your bank after the customer submits a report. Dispatch waits for confirmation; the system does not access your bank or transfer funds.",
                                  )
                                : text(
                                    "客人提交資料只代表聲明，未確認入帳前不會派單。此為 TRL 3 測試，請用虛構交易。",
                                    "A customer report is a claim; dispatch waits for independent bank verification. Use fictional transactions for TRL 3.",
                                  )}
                            </p>
                            {workspace?.capabilities.payment ===
                              "bank_transfer" &&
                              !workspace.capabilities
                                .bank_transfer_configured && (
                                <p className="ev-error">
                                  {text(
                                    "收款銀行資料未設定，暫時不能接受付款預約。請聯絡系統管理員完成設定。",
                                    "Bank details are not configured. Ask your system administrator to complete setup before accepting payment bookings.",
                                  )}
                                </p>
                              )}

                            <div className="ev-form-grid">
                              {!refundEntry && (
                                <label>
                                  {text(
                                    "待對數轉帳聲明",
                                    "Pending transfer report",
                                  )}
                                  <select
                                    aria-label={text(
                                      "待對數轉帳聲明",
                                      "Pending transfer report",
                                    )}
                                    value={fps.submission_id}
                                    onChange={(e) => {
                                      const sub =
                                        workspace?.payment_submissions.find(
                                          (s) => s.id === e.target.value,
                                        );
                                      setFps({
                                        ...fps,
                                        submission_id: e.target.value,
                                        verified: false,
                                        amount: String(
                                          sub?.amount ||
                                            c.payment_amount ||
                                            c.quote?.total ||
                                            "",
                                        ),
                                      });
                                    }}
                                  >
                                    <option value="">
                                      {text("請選擇", "Select")}
                                    </option>
                                    {pendingReports.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.reference} · HK${s.amount}
                                      </option>
                                    ))}
                                  </select>
                                  <small className="form-hint">
                                    {text(
                                      "請按銀行紀錄核實，家屬聲明不代表已入帳。",
                                      "Verify against bank records; a family report does not confirm receipt.",
                                    )}
                                  </small>
                                </label>
                              )}
                              {refundEntry && (
                                <p className="ev-refund-amount">
                                  {text(
                                    "已批核退款金額",
                                    "Approved refund amount",
                                  )}
                                  <strong>
                                    HK$
                                    {(c.refund_amount ?? 0).toLocaleString(
                                      "en-HK",
                                    )}
                                  </strong>
                                </p>
                              )}
                              <label>
                                {text(
                                  "銀行入帳／退款轉帳參考",
                                  "Bank receipt / refund reference",
                                )}
                                <input
                                  value={fps.bank_reference}
                                  maxLength={100}
                                  placeholder={text(
                                    "按銀行紀錄填寫",
                                    "Reference from bank record",
                                  )}
                                  onChange={(e) =>
                                    setFps({
                                      ...fps,
                                      bank_reference: e.target.value,
                                      verified: false,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                {text("核實金額 HKD", "Verified amount HKD")}
                                <input
                                  type="number"
                                  min="1"
                                  value={fps.amount}
                                  onChange={(e) =>
                                    setFps({
                                      ...fps,
                                      amount: e.target.value,
                                      verified: false,
                                    })
                                  }
                                />
                                {fps.amount &&
                                  Number(fps.amount) !==
                                    (refundEntry
                                      ? c.refund_amount
                                      : (c.payment_amount ??
                                        c.quote?.total)) && (
                                    <small className="ev-amount-warning">
                                      {text(
                                        "金額與應付金額不符，請核實後再確認。",
                                        "The amount differs from the expected total. Check it before confirming.",
                                      )}
                                    </small>
                                  )}
                              </label>
                              <label>
                                {text(
                                  "銀行入帳／退款轉帳時間 HKT",
                                  "Bank receipt / refund time HKT",
                                )}
                                <input
                                  type="datetime-local"
                                  value={fps.received_at}
                                  onChange={(e) =>
                                    setFps({
                                      ...fps,
                                      received_at: e.target.value,
                                      verified: false,
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <label>
                              {text(
                                "對數／退款說明",
                                "Reconciliation / refund note",
                              )}
                              <textarea
                                value={paymentNote}
                                onChange={(e) => setPaymentNote(e.target.value)}
                                placeholder={text(
                                  "記錄核對結果或不符原因",
                                  "Record the verification result or mismatch",
                                )}
                              />
                            </label>
                            <label className="ev-check">
                              <input
                                type="checkbox"
                                checked={fps.verified}
                                onChange={(e) =>
                                  setFps({ ...fps, verified: e.target.checked })
                                }
                              />
                              {workspace?.capabilities.payment ===
                              "bank_transfer"
                                ? text(
                                    "我已登入銀行獨立核對實際入帳／退款，金額及參考正確。",
                                    "I independently checked the actual bank receipt or refund, amount and reference.",
                                  )
                                : text(
                                    "我已獨立核對銀行紀錄，金額及參考正確（測試用虛構銀行紀錄）。",
                                    "I independently checked the bank record, amount and reference (fictional bank record for testing).",
                                  )}
                            </label>
                            {error && (
                              <p role="alert" className="ev-error">
                                {error}
                              </p>
                            )}
                            <div className="ev-actions">
                              {!refundEntry && (
                                <>
                                  <button
                                    className="button primary"
                                    disabled={
                                      busy ||
                                      !validBankRecord ||
                                      !pendingReports.some(
                                        (s) => s.id === fps.submission_id,
                                      )
                                    }
                                    onClick={() =>
                                      run(() => fpsAction("reconcile_fps"))
                                    }
                                  >
                                    {text(
                                      "確認銀行入帳，完成對數",
                                      "Confirm bank receipt after reconciliation",
                                    )}
                                  </button>
                                  <button
                                    className="button secondary"
                                    disabled={
                                      busy ||
                                      !paymentNote.trim() ||
                                      !pendingReports.some(
                                        (s) => s.id === fps.submission_id,
                                      )
                                    }
                                    onClick={() =>
                                      run(() => fpsAction("reject_fps"))
                                    }
                                  >
                                    {text(
                                      "對數不符，退回跟進",
                                      "Reject unmatched transfer report",
                                    )}
                                  </button>
                                </>
                              )}
                              {refundEntry && (
                                <button
                                  className="button primary"
                                  disabled={busy || !validBankRecord}
                                  onClick={() =>
                                    run(() => fpsAction("record_fps_refund"))
                                  }
                                >
                                  {text(
                                    "記錄已完成轉帳退款",
                                    "Record completed bank transfer refund",
                                  )}
                                </button>
                              )}
                            </div>
                            <p className="form-hint">
                              {text(
                                "填妥資料及核實聲明後，才可確認。所有時間均為香港時間。",
                                "Complete the fields and verification before confirming. All times are Hong Kong time.",
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="ev-finance-empty">
                            {c.status === "PENDING_PAY"
                              ? text(
                                  "未有待對數轉帳聲明。家屬提交資料後，會在此顯示核對表格。",
                                  "No transfer report to review. The reconciliation form appears after the family submits a report.",
                                )
                              : text(
                                  "目前沒有需要核對的收款或記錄的退款。",
                                  "No payment reconciliation or refund entry is currently required.",
                                )}
                          </p>
                        )}
                        {!!workspace?.payment_reconciliations.filter(
                          (r) => r.case_id === c.id,
                        ).length && (
                          <details className="ev-finance-history">
                            <summary>
                              {text(
                                "查看已核實收款紀錄",
                                "View verified payment records",
                              )}
                            </summary>
                            {workspace.payment_reconciliations
                              .filter((r) => r.case_id === c.id)
                              .map((r) => (
                                <div key={r.id}>
                                  <strong>
                                    HK${r.amount.toLocaleString("en-HK")}
                                  </strong>
                                  <span>{r.bank_reference || r.id}</span>
                                  <small>
                                    {text("核實職員：", "Verified by: ")}
                                    {r.verified_by}
                                  </small>
                                </div>
                              ))}
                          </details>
                        )}
                      </section>
                    )}
                    {(!operational ||
                      ![
                        "CANCELLED",
                        "EXPIRED",
                        "PAY_TIMEOUT",
                        "DONE",
                        "NO_FIRST_INSERT",
                      ].includes(c.status) ||
                      c.refund_status === "PENDING") && (
                      <details className="ev-admin">
                        <summary>
                          {text(
                            "人工覆核／取消退款／重新招募",
                            "Manual review, cancellation, refunds and reposting",
                          )}
                        </summary>
                        <label>
                          {text("覆核／操作原因", "Review / action reason")}
                          <textarea
                            aria-label={text(
                              "覆核／操作原因",
                              "Review / action reason",
                            )}
                            value={adminReason}
                            onChange={(e) => setAdminReason(e.target.value)}
                          />
                        </label>
                        {c.status === "MANUAL" && !c.package_id && (
                          <details>
                            <summary>
                              {text(
                                "更正醫生指示／現有喉管資料",
                                "Correct doctor order / existing tube facts",
                              )}
                            </summary>
                            <p>
                              {text(
                                "更正後仍須重新驗證及發報價；不代表醫生文件已核實。",
                                "Corrections require revalidation and a new quote; they do not verify a doctor document.",
                              )}
                            </p>
                            <label>
                              {text("醫生指示", "Doctor order")}
                              <select
                                value={correctedOrder}
                                onChange={(e) =>
                                  setCorrectedOrder(e.target.value)
                                }
                              >
                                {["YES", "NO", "UNSURE", "NA"].map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            </label>
                            {c.services
                              ?.filter((s) => s.replace_only)
                              .map((s) => (
                                <label key={s.id}>
                                  {s.label}
                                  <select
                                    value={correctedTubes[s.id!] || "UNSURE"}
                                    onChange={(e) =>
                                      setCorrectedTubes({
                                        ...correctedTubes,
                                        [s.id!]: e.target.value,
                                      })
                                    }
                                  >
                                    {["YES", "NO_FIRST_INSERT", "UNSURE"].map(
                                      (v) => (
                                        <option key={v}>{v}</option>
                                      ),
                                    )}
                                  </select>
                                </label>
                              ))}
                            <button
                              className="button secondary"
                              disabled={busy || !adminReason.trim()}
                              onClick={() =>
                                run(() => action("correct_intake"))
                              }
                            >
                              {text("記錄更正", "Record correction")}
                            </button>
                          </details>
                        )}
                        {c.red_flag && (
                          <div>
                            <label>
                              {text(
                                "紅旗處置／轉介結果（至少 10 字；未填不可發報價）",
                                "Red-flag resolution / referral (at least 10 characters; required before quoting)",
                              )}
                              <textarea
                                value={redFlagResolution}
                                onChange={(e) =>
                                  setRedFlagResolution(e.target.value)
                                }
                                minLength={10}
                              />
                            </label>
                            <label className="ev-check">
                              <input
                                type="checkbox"
                                checked={redFlagConfirmed}
                                onChange={(e) =>
                                  setRedFlagConfirmed(e.target.checked)
                                }
                              />
                              {text(
                                "我確認已記錄臨床處置／轉介結果，並解除此個案的報價阻擋。",
                                "I confirm the clinical resolution or referral is recorded and this case may proceed to quoting.",
                              )}
                            </label>
                          </div>
                        )}
                        <label>
                          {text(
                            "偏遠分類（只影響護士交通津貼）",
                            "Remote tier (nurse allowance only)",
                          )}
                          <select
                            value={remoteTier}
                            onChange={(e) => setRemoteTier(e.target.value)}
                          >
                            {["A", "B", "C"].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </label>
                        {c.status === "MANUAL" &&
                          ["NIGHT10", "NIGHT12"].includes(c.shift || "") &&
                          c.intake_channel !== "conversation" && (
                            <fieldset>
                              <legend>
                                {text(
                                  "星期日／公眾假期夜更人工報價",
                                  "Manual Sunday / holiday night quote",
                                )}
                              </legend>
                              <p className="form-hint">
                                {text(
                                  "暫未有統一加價規則。如發報價時提示夜更涉及星期日／公眾假期，請先核實逐單收費，再填寫金額。此功能只適用於該類夜更。",
                                  "There is no standard surcharge rule yet. If quoting is blocked because the night visit involves a Sunday or public holiday, verify this visit's charges before entering amounts. This option applies only to those night visits.",
                                )}
                              </p>
                              <label className="ev-check">
                                <input
                                  type="checkbox"
                                  checked={manualNightQuote}
                                  onChange={(e) => {
                                    setManualNightQuote(e.target.checked);
                                    setManualNightConfirmed(false);
                                  }}
                                />
                                {text(
                                  "使用人工確認的夜更收費",
                                  "Use manually reviewed night charges",
                                )}
                              </label>
                              {manualNightQuote && (
                                <>
                                  <div className="ev-form-grid">
                                    <label>
                                      {text(
                                        "人工基本費 HKD（整數）",
                                        "Manual base fee HKD (whole dollars)",
                                      )}
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={manualNightBase}
                                        onChange={(e) => {
                                          setManualNightBase(e.target.value);
                                          setManualNightConfirmed(false);
                                        }}
                                      />
                                    </label>
                                    <label>
                                      {text(
                                        "人工附加費 HKD（無附加費請填 0）",
                                        "Manual surcharge HKD (enter 0 for none)",
                                      )}
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={manualNightSurcharge}
                                        onChange={(e) => {
                                          setManualNightSurcharge(
                                            e.target.value,
                                          );
                                          setManualNightConfirmed(false);
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <p>
                                    {text("人工報價總額", "Manual quote total")}
                                    : HK$
                                    {/^\d+$/.test(manualNightBase) &&
                                    /^\d+$/.test(manualNightSurcharge)
                                      ? (
                                          Number(manualNightBase) +
                                          Number(manualNightSurcharge)
                                        ).toLocaleString("en-HK")
                                      : "—"}
                                  </p>
                                  <p className="form-hint">
                                    {text(
                                      "請在上方「覆核／操作原因」記錄至少 10 字的收費依據；原因只供內部紀錄。報價電郵會列出基本費、附加費及總額。",
                                      "Record the pricing basis in the review / action reason above (at least 10 characters, for internal records). The quote email will show the base fee, surcharge and total.",
                                    )}
                                  </p>
                                  <label className="ev-check">
                                    <input
                                      type="checkbox"
                                      checked={manualNightConfirmed}
                                      onChange={(e) =>
                                        setManualNightConfirmed(
                                          e.target.checked,
                                        )
                                      }
                                    />
                                    {text(
                                      "我已核實此夜更的基本費、附加費及總額，確認按以上金額發報價。",
                                      "I have verified this night's base fee, surcharge and total and confirm issuing the quote for these amounts.",
                                    )}
                                  </label>
                                </>
                              )}
                            </fieldset>
                          )}
                        {c.status === "MANUAL" && quoteBlockers.length > 0 && (
                          <div
                            id="quote-requirements"
                            role="status"
                            className="staff-notice"
                          >
                            <strong>
                              {text(
                                "發報價前尚欠以下步驟",
                                "Complete these steps before issuing a quote",
                              )}
                            </strong>
                            <ul>
                              {quoteBlockers.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="ev-actions">
                          {[
                            [
                              "remote",
                              text(
                                "覆核地點及交通津貼",
                                "Review location / allowance",
                              ),
                            ],
                            [
                              "issue_quote",
                              text(
                                "人工處理後發報價",
                                "Issue quote after review",
                              ),
                            ],
                            [
                              "manual_refund",
                              text(
                                "人工決定退款／放回時數（待批核）",
                                "Request refund for paid manual case",
                              ),
                            ],
                            [
                              "refund",
                              text(
                                "批核退款／釋放時數",
                                "Approve refund / release hours",
                              ),
                            ],
                            [
                              "doctor_upload_link",
                              text(
                                "重發醫生指示文件上載連結",
                                "Resend doctor document upload link",
                              ),
                            ],
                            ["repost", text("再次招募", "Repost")],
                            [
                              "reschedule",
                              text("改期交人手", "Manual reschedule"),
                            ],
                            [
                              "manual_cancel",
                              text(
                                "結束未收款人工個案",
                                "Close unpaid manual case",
                              ),
                            ],
                            ...(!session
                              ? [
                                  [
                                    "doctor_failed",
                                    text(
                                      "醫生指示核對失敗",
                                      "Doctor order failed",
                                    ),
                                  ],
                                ]
                              : []),
                          ]
                            .filter(
                              ([a]) =>
                                !operational ||
                                (a === "remote"
                                  ? ["MANUAL", "QUOTED", "PAID"].includes(
                                      c.status,
                                    )
                                  : a === "issue_quote"
                                    ? c.status === "MANUAL" &&
                                      c.intake_channel !== "conversation"
                                    : a === "manual_refund"
                                      ? c.status === "MANUAL" &&
                                        (!!c.amount_paid ||
                                          c.order_type === "PACKAGE_EXISTING")
                                      : a === "refund"
                                        ? c.status === "FULL_REFUND" &&
                                          c.refund_status === "PENDING"
                                        : a === "doctor_upload_link"
                                          ? [
                                              "PAID",
                                              "POSTED",
                                              "MATCHED",
                                            ].includes(c.status) &&
                                            c.schedule_status ===
                                              "PENDING_REVIEW" &&
                                            c.services?.some(
                                              (s) => s.doctor_order_required,
                                            )
                                          : a === "repost"
                                            ? ["POSTED", "REMATCH"].includes(
                                                c.status,
                                              )
                                            : a === "reschedule"
                                              ? [
                                                  "QUOTED",
                                                  "PAID",
                                                  "POSTED",
                                                  "MATCHED",
                                                  "READY",
                                                ].includes(c.status)
                                              : a === "manual_cancel"
                                                ? c.status === "MANUAL" &&
                                                  !c.amount_paid &&
                                                  !c.package_id
                                                : true),
                            )
                            .map(([a, label]) => (
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  (a === "issue_quote" &&
                                    quoteBlockers.length > 0)
                                }
                                aria-describedby={
                                  a === "issue_quote" &&
                                  quoteBlockers.length > 0
                                    ? "quote-requirements"
                                    : undefined
                                }
                                className="button secondary"
                                key={a}
                                onClick={() =>
                                  run(() => action(a), {
                                    pending: text(
                                      "正在處理，請稍候…",
                                      "Processing, please wait…",
                                    ),
                                    success:
                                      a === "remote"
                                        ? text(
                                            "已儲存地點覆核及交通津貼分類。核實其餘服務資料後，可按「人工處理後發報價」。",
                                            "Location and allowance review saved. After verifying the remaining service details, issue the quote below.",
                                          )
                                        : a === "issue_quote"
                                          ? text(
                                              "已建立報價並排入電郵傳送佇列。請到「電郵通知」查看寄送結果。",
                                              "Quote created and queued for email delivery. Check Messages for the delivery result.",
                                            )
                                          : text(
                                              "操作已儲存。",
                                              "Action saved.",
                                            ),
                                  })
                                }
                              >
                                {label}
                              </button>
                            ))}
                        </div>
                        {actionFeedback && (
                          <div
                            ref={actionFeedbackRef}
                            tabIndex={-1}
                            role={error ? "alert" : "status"}
                            className={error ? "ev-error" : "staff-notice"}
                          >
                            {error || actionFeedback}
                          </div>
                        )}
                        <p className="form-hint">
                          {text(
                            operational
                              ? "未確認收款不能派單。退款須先批核，再由同事於銀行轉帳並獨立記錄。"
                              : "未收款不能派單；退款只可由待批核狀態處理。真人收款／退款不屬本實驗。",
                            operational
                              ? "Dispatch requires verified payment. Refunds require approval followed by a separately recorded bank transfer."
                              : "Dispatch needs payment. Refund approval requires a pending request. Live payment/refund is outside this experiment.",
                          )}
                        </p>
                      </details>
                    )}
                    {c.status === "MANUAL" && c.manual_reason && (
                      <p className="ev-error">{c.manual_reason}</p>
                    )}
                    <details
                      className="ev-workflow"
                      open={[
                        "PAID",
                        "POSTED",
                        "REMATCH",
                        "MATCHED",
                        "READY",
                        "IN_SERVICE",
                      ].includes(c.status)}
                    >
                      <summary>
                        {text(
                          "派單及服務安排",
                          "Dispatch and care arrangements",
                        )}
                      </summary>
                      {operational && workspace && (
                        <DispatchDelivery
                          c={c}
                          workspace={workspace}
                          zh={zh}
                          busy={busy}
                          onRetry={(id) =>
                            void run(() => request("/api/email-retry", { id }))
                          }
                        />
                      )}
                      <ol className="ev-steps">
                        <li>
                          {text(
                            operational
                              ? "請家屬從報價電郵中的連結確認接受報價。"
                              : "到收件箱開啟報價電郵中的連結，再在確認頁接受報價。",
                            operational
                              ? "The family confirms acceptance through the link in their quote email."
                              : "Open the quotation email link in the inbox, then confirm acceptance.",
                          )}
                        </li>
                        <li>
                          {text(
                            "家屬人手轉帳及提交資料，管理員核對銀行入帳；確認收款後預覽派單。",
                            "Transfer manually and submit details; administrator verifies the bank receipt before approving dispatch.",
                          )}
                          <div>
                            {workspace?.capabilities.payment === "mock" && (
                              <button
                                disabled={busy || c.status !== "PENDING_PAY"}
                                className="button secondary"
                                onClick={() => run(() => action("mock_paid"))}
                              >
                                {text("模擬付款成功", "Simulate paid")}
                              </button>
                            )}
                            <button
                              disabled={busy || c.status !== "PAID"}
                              className="button primary"
                              onClick={() => run(() => action("dispatch"))}
                            >
                              {text(
                                "確認預覽並派單",
                                "Approve preview and dispatch",
                              )}
                            </button>
                          </div>
                          <details>
                            <summary>
                              {text(
                                "派單預覽（不含姓名、電話、單位）",
                                "Dispatch preview (no name, phone or unit)",
                              )}
                            </summary>
                            <pre>{c.dispatch_preview_body}</pre>
                          </details>
                        </li>
                        <li>
                          {text(
                            "護士從自己的接單邀請電郵確認接單，第一個有效確認者得標。",
                            "Nurses confirm through their own invitation emails; the first valid acceptance wins.",
                          )}
                        </li>
                        <li>
                          {text(
                            "護士接單後，家屬會收到填寫樓層及單位的電郵；護理時間表另須產生草稿、資深護士覆核及管理員最終確認。",
                            "After a nurse accepts, the family receives an address request. The care schedule separately needs a draft, senior nurse review and final administrator approval.",
                          )}
                          {session?.method === "google" && (
                            <p className="form-hint">
                              {text(
                                "資深護士須用另一帳戶進入護理覆核工作台；完成覆核後，在此重新整理並作最終確認。",
                                "A senior nurse must review from their own account. Refresh here after their review, then give final approval.",
                              )}
                            </p>
                          )}
                          <div className="ev-actions">
                            {(["draft", "nurse", "admin"] as const)
                              .filter(
                                (step) =>
                                  !(
                                    session?.method === "google" &&
                                    step === "nurse"
                                  ),
                              )
                              .map((step) => (
                                <button
                                  className="button secondary"
                                  key={step}
                                  disabled={
                                    busy ||
                                    (session?.method === "google" &&
                                      step === "nurse") ||
                                    !["PAID", "POSTED", "MATCHED"].includes(
                                      c.status,
                                    ) ||
                                    (step === "draft"
                                      ? !!c.schedule
                                      : step === "nurse"
                                        ? !c.schedule ||
                                          c.schedule_status !== "PENDING_REVIEW"
                                        : c.schedule_status !==
                                          "NURSE_REVIEWED")
                                  }
                                  onClick={() => run(() => action(step))}
                                >
                                  {
                                    {
                                      draft: text(
                                        "產生規則草稿",
                                        "Generate rules draft",
                                      ),
                                      nurse: text(
                                        "資深護士覆核",
                                        "Senior nurse review",
                                      ),
                                      admin: text(
                                        "管理員最終確認",
                                        "Administrator final approval",
                                      ),
                                    }[step]
                                  }
                                </button>
                              ))}
                          </div>
                        </li>
                        <li>
                          {text(
                            "護士已接單、家屬已提供完整地址、護理時間表已完成最終批核，三項齊備後才寄出完整服務資料，個案轉為「待服務」。",
                            "Full care details are emailed only when a nurse has accepted, the family has provided the address and the schedule has final approval. The case then becomes ready for service.",
                          )}
                        </li>
                      </ol>
                      <div className="ev-gates">
                        <span>
                          {text("得標護士", "Assigned nurse")}:{" "}
                          {workspace?.nurses.find(
                            (n) => n.id === c.assigned_nurse,
                          )?.name ||
                            c.assigned_nurse ||
                            text("尚未接單", "No acceptance yet")}
                        </span>
                        <span>
                          {text("地址", "Address")}:{" "}
                          {c.address_status === "PROVIDED"
                            ? text("家屬已提供", "Provided by family")
                            : c.address_status === "ASKED"
                              ? text("等候家屬填寫", "Awaiting family response")
                              : text(
                                  "護士接單後索取",
                                  "Requested after nurse acceptance",
                                )}
                        </span>
                        <span>
                          {text("護理時間表", "Care schedule")}:{" "}
                          {c.schedule_status === "CONFIRMED"
                            ? text(
                                "管理員已最終批核",
                                "Final approval complete",
                              )
                            : c.schedule_status === "NURSE_REVIEWED"
                              ? text(
                                  "護士已覆核，待管理員批核",
                                  "Nurse reviewed, awaiting final approval",
                                )
                              : c.schedule
                                ? text(
                                    "已有草稿，待資深護士覆核",
                                    "Draft ready, awaiting senior nurse review",
                                  )
                                : text("尚未產生草稿", "No draft yet")}
                        </span>
                      </div>
                      {c.schedule && !session && (
                        <details className="ev-admin">
                          <summary>
                            {text(
                              "人手修改時間表（須重新覆核）",
                              "Edit schedule (requires reapproval)",
                            )}
                          </summary>
                          <button
                            className="button secondary"
                            onClick={() =>
                              setScheduleEdit(
                                JSON.stringify(c.schedule, null, 2),
                              )
                            }
                          >
                            {text("載入現有草稿", "Load draft")}
                          </button>
                          <textarea
                            aria-label="Schedule JSON"
                            value={scheduleEdit}
                            onChange={(e) => setScheduleEdit(e.target.value)}
                          />
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => run(() => action("schedule_edit"))}
                          >
                            {text(
                              "記錄修改（需填原因）",
                              "Record edit (reason required)",
                            )}
                          </button>
                        </details>
                      )}
                      {c.schedule && (
                        <pre>
                          {c.schedule
                            .map(
                              (x) =>
                                `${x.time} ${x.item}${x.note ? `（${x.note}）` : ""}`,
                            )
                            .join("\n")}
                        </pre>
                      )}
                    </details>
                    {workspace?.capabilities.test_clock && (
                      <details className="ev-admin">
                        <summary>
                          {text(
                            "虛擬時鐘測試（不代表真實 24h 證據）",
                            "Virtual clock (not real 24h evidence)",
                          )}
                        </summary>
                        <label>
                          {text("向前推進至 HKT", "Advance to HKT")}
                          <input
                            type="datetime-local"
                            value={clockTo}
                            onChange={(e) => setClockTo(e.target.value)}
                          />
                        </label>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              request("/api/test-clock", {
                                to: new Date(clockTo + "+08:00").toISOString(),
                              }),
                            )
                          }
                        >
                          {text("推進虛擬時間", "Advance virtual clock")}
                        </button>
                      </details>
                    )}
                    {!["CANCELLED", "EXPIRED", "PAY_TIMEOUT", "DONE"].includes(
                      c.status,
                    ) && (
                      <p className="form-hint">
                        {text(
                          "護士自行安排的項目不設提醒。定時項目提前 10 分鐘提醒，未確認一小時後追問。計時器每分鐘執行一次。",
                          "Tasks arranged by the nurse have no reminders. Timed tasks notify 10 minutes before, with a one-hour follow-up. Worker runs every minute.",
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p>{text("建立個案開始驗證。", "Create a case to begin.")}</p>
                )}
              </section>
            )}
          </div>
        )}
      {tab === "inbox" && (
        <div className="ev-inbox">
          <section className="panel ev-mail-list">
            <h2>{text("測試電郵", "Test emails")}</h2>
            <p className="form-hint">
              {text(
                "captured = 已存本機，未真正寄出；sent = SMTP 已接收，並非收件人已讀。",
                "captured = local only; sent = SMTP accepted, not proof of recipient reading.",
              )}
            </p>
            {emails.map((m) => (
              <button
                key={m.id}
                className={mail?.id === m.id ? "active" : ""}
                onClick={() => setMailId(m.id)}
              >
                <strong>{m.to}</strong>
                <span>{m.subject}</span>
                <small>{m.status}</small>
              </button>
            ))}
          </section>
          <section className="panel ev-panel">
            {mail ? (
              <>
                <p>{mail.status}</p>
                <h2>{mail.subject}</h2>
                <p>To: {mail.to}</p>
                {mail.status === "sent" && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        request("/api/email-receipt", {
                          id: mail.id,
                          note: "管理員已向受控測試收件人確認收件",
                        }),
                      )
                    }
                  >
                    {text(
                      "記錄已向測試收件人確認收件",
                      "Record confirmation from test recipient",
                    )}
                  </button>
                )}
                {mail.error && <p className="ev-error">{mail.error}</p>}
                <EmailPreview mail={mail} />
                <details className="ev-email-plain">
                  <summary>
                    {text("純文字及操作連結", "Plain text and action links")}
                  </summary>
                  <pre>{mail.body}</pre>
                  <div className="ev-actions">
                    {mail.links.map((l) => (
                      <a
                        className="button primary"
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        key={l.url}
                      >
                        {labels[l.label] || l.label}
                        <ArrowRight size={15} />
                      </a>
                    ))}
                  </div>
                </details>
                <p className="form-hint">
                  {text(
                    "連結只開確認頁；按確認先更改個案。操作後按重新整理。",
                    "Links open a confirmation page. Confirm there to apply the action, then refresh here.",
                  )}
                </p>
              </>
            ) : (
              <p>{text("尚未有電郵。", "No emails yet.")}</p>
            )}
          </section>
        </div>
      )}
      {tab === "ledger" && (
        <section className="panel ev-panel">
          <h2>
            {text("套餐帳本及待付護士薪酬", "Package ledger and nurse payouts")}
          </h2>
          {workspace?.packages.map((p) => (
            <article className="ev-gates" key={p.id}>
              <strong>
                {p.id} · {p.status} · {p.patient_ref}
              </strong>
              <span>
                {text(
                  "總數／已用／預留／可用",
                  "Total / used / reserved / available",
                )}
                : {p.hours_total} / {p.hours_used} / {p.hours_reserved} /{" "}
                {p.hours_total - p.hours_used - p.hours_reserved} h
              </span>
            </article>
          ))}
          <div className="ev-event-table">
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Case</th>
                  <th>Type</th>
                  <th>Hours</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {workspace?.ledger_entries.map((l) => (
                  <tr key={l.id}>
                    <td>{l.package_id}</td>
                    <td>{l.case_id}</td>
                    <td>{l.type}</td>
                    <td>{l.hours}</td>
                    <td>{l.available_after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>
            {text(
              "護士薪酬只記錄、不轉帳",
              "Nurse payouts: records only, no transfers",
            )}
          </h3>
          {operational && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await request("/api/payout", {
                    ...payoutForm,
                    amount: Number(payoutForm.amount),
                    paid_at: new Date(
                      payoutForm.paid_at + "+08:00",
                    ).toISOString(),
                  });
                  setPayoutForm({
                    id: "",
                    amount: "",
                    bank_reference: "",
                    paid_at: "",
                    note: "",
                    verified: false,
                  });
                });
              }}
            >
              <h3>
                {text("記錄已轉帳薪酬", "Record completed payout transfer")}
              </h3>
              <div className="ev-form-grid">
                <label>
                  {text("待付薪酬", "Pending payout")}
                  <select
                    required
                    value={payoutForm.id}
                    onChange={(e) => {
                      const p = workspace?.payouts.find(
                        (p) => p.id === e.target.value,
                      );
                      setPayoutForm({
                        ...payoutForm,
                        id: e.target.value,
                        amount: String(p?.total || ""),
                      });
                    }}
                  >
                    <option value="">{text("請選擇", "Select")}</option>
                    {workspace?.payouts
                      .filter((p) => p.status === "PENDING")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.case_id} · {p.nurse_id} · HK${p.total}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {text("已轉帳金額 HKD", "Transferred amount HKD")}
                  <input
                    required
                    type="number"
                    min="1"
                    value={payoutForm.amount}
                    onChange={(e) =>
                      setPayoutForm({ ...payoutForm, amount: e.target.value })
                    }
                  />
                </label>
                <label>
                  {text("銀行轉帳參考", "Bank transfer reference")}
                  <input
                    required
                    value={payoutForm.bank_reference}
                    onChange={(e) =>
                      setPayoutForm({
                        ...payoutForm,
                        bank_reference: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {text("轉帳時間（香港）", "Transfer time (Hong Kong)")}
                  <input
                    required
                    type="datetime-local"
                    value={payoutForm.paid_at}
                    onChange={(e) =>
                      setPayoutForm({ ...payoutForm, paid_at: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                {text("付款說明", "Payment note")}
                <textarea
                  required
                  value={payoutForm.note}
                  onChange={(e) =>
                    setPayoutForm({ ...payoutForm, note: e.target.value })
                  }
                />
              </label>
              <label className="ev-check">
                <input
                  required
                  type="checkbox"
                  checked={payoutForm.verified}
                  onChange={(e) =>
                    setPayoutForm({ ...payoutForm, verified: e.target.checked })
                  }
                />
                {text(
                  "我已核對銀行紀錄，確認薪酬已轉帳。",
                  "I checked the bank record and confirm the payout was transferred.",
                )}
              </label>
              <button className="button primary" disabled={busy}>
                {text("記錄已付款", "Record payment")}
              </button>
            </form>
          )}
          {workspace?.payouts.map((p) => (
            <p key={p.id}>
              {p.case_id} · {p.nurse_id} · HK${p.total} · {p.status}
              {p.bank_reference && (
                <>
                  <br />
                  {p.bank_reference} · {p.paid_by} ·{" "}
                  {p.paid_at
                    ? new Date(p.paid_at).toLocaleString(
                        zh ? "zh-HK" : "en-HK",
                        { timeZone: "Asia/Hong_Kong" },
                      )
                    : ""}
                </>
              )}
            </p>
          ))}
        </section>
      )}
      {tab === "acceptance" && (
        <section className="panel ev-panel">
          <h2>
            {text("完整驗收及實驗證據", "Acceptance and experiment evidence")}
          </h2>
          <p>
            {text(
              "軟件實作、模擬測試及外部實測分開記錄。只填寫真正觀察到的結果。",
              "Separate implementation, simulation and external observations. Record only observed results.",
            )}
          </p>
          <ul>
            {workspace?.evidence_requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => request("/api/evidence", evidenceForm));
            }}
          >
            <div className="ev-form-grid">
              <label>
                {text("驗收編號／實驗", "Acceptance ID / experiment")}
                <input
                  required
                  value={evidenceForm.requirement}
                  onChange={(e) =>
                    setEvidenceForm({
                      ...evidenceForm,
                      requirement: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                {text("結果", "Result")}
                <select
                  value={evidenceForm.result}
                  onChange={(e) =>
                    setEvidenceForm({ ...evidenceForm, result: e.target.value })
                  }
                >
                  {["PENDING", "PASS", "FAIL"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                {text("觀察及測試條件", "Observations / conditions")}
                <textarea
                  required
                  value={evidenceForm.note}
                  onChange={(e) =>
                    setEvidenceForm({ ...evidenceForm, note: e.target.value })
                  }
                />
              </label>
              <label>
                {text("截圖／檔案代號", "Screenshot / artifact reference")}
                <input
                  value={evidenceForm.artifact}
                  onChange={(e) =>
                    setEvidenceForm({
                      ...evidenceForm,
                      artifact: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <button disabled={busy} className="button primary">
              {text("追加實測證據", "Append observation")}
            </button>
          </form>
          {workspace?.evidence.map((e) => (
            <article className="ev-gates" key={e.id}>
              <strong>
                {e.requirement} · {e.result}
              </strong>
              <span>
                {e.note} · {e.artifact}
              </span>
            </article>
          ))}
          <h3>{text("護士第三次放飛批核", "Third-drop nurse review")}</h3>
          {workspace?.nurses
            .filter((n) => n.status === "SUSPENDED")
            .map((n) => (
              <p key={n.id}>
                {n.id}{" "}
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() =>
                    run(() =>
                      request("/api/nurse-action", {
                        id: n.id,
                        action: "blacklist",
                        reason: adminReason,
                      }),
                    )
                  }
                >
                  {text(
                    "確認列入黑名單（需填覆核原因）",
                    "Confirm blacklist (review reason required)",
                  )}
                </button>
              </p>
            ))}
          <details>
            <summary>
              {text("偏遠名單版本匯入", "Import versioned remote list")}
            </summary>
            <p>
              JSON:{" "}
              {JSON.stringify({
                version: "reviewed-list-v1",
                rows: [{ place: "長洲", tier: "A", district: "離島" }],
              })}
            </p>
            <textarea
              value={remoteImport}
              onChange={(e) => setRemoteImport(e.target.value)}
            />
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  request("/api/remote-import", JSON.parse(remoteImport)),
                )
              }
            >
              {text("匯入已核對名單", "Import reviewed list")}
            </button>
          </details>
          <details>
            <summary>
              {text("範本及範圍清單", "Template scope catalog")}
            </summary>
            {Object.entries(workspace?.template_catalog || {}).map(
              ([id, t]) => (
                <p key={id}>{t.description}</p>
              ),
            )}
          </details>
        </section>
      )}
      {tab === "events" && (
        <section className="panel ev-panel">
          <h2>{text("可追查流程紀錄", "Traceable workflow events")}</h2>
          <p>
            {text(
              "紀錄代表已發生嘅操作，並非自動判定所有驗收通過。時間以香港時區顯示，匯出為 ISO 8601。",
              "Events record observed actions; they do not certify acceptance. Display uses Hong Kong time; exports use ISO 8601.",
            )}
          </p>
          <button className="button secondary" onClick={exportCSV}>
            CSV · {text("匯出事件", "Export events")}
          </button>
          <div className="ev-event-table">
            <table>
              <thead>
                <tr>
                  <th>HKT</th>
                  <th>Case</th>
                  <th>Event</th>
                  <th>{text("執行人", "Operator")}</th>
                  <th>time_scale</th>
                </tr>
              </thead>
              <tbody>
                {workspace?.events
                  .filter((e) => !selected || e.case_id === selected)
                  .slice()
                  .reverse()
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        {new Date(e.at).toLocaleString("zh-HK", {
                          timeZone: "Asia/Hong_Kong",
                        })}
                      </td>
                      <td>{e.case_id || "—"}</td>
                      <td>
                        <strong>{e.event}</strong>
                        {e.reason && <p>{e.reason}</p>}
                      </td>
                      <td>
                        {e.actor_code || e.actor || "system"}
                        <br />
                        {e.auth_method || ""}
                      </td>
                      <td>{e.time_scale}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <button
            disabled={busy}
            className="button secondary"
            onClick={() => run(() => request("/api/tick", {}))}
          >
            {text("立即掃描到期計時器", "Run due timers now")}
          </button>
        </section>
      )}
    </div>
  );
}

type ClinicalCase = Case & {
  patient_ref?: string;
  age?: number | string;
  gender?: string;
  medical_history?: string;
  remarks?: string;
  enquiry_summary?: string;
  preferred_timing?: string;
  patient_age_description?: string;
  doctor_order?: string;
  doctor_order_status?: string;
  doctor_order_file?: string;
  doctor_document?: {
    id: string;
    sha256: string;
    size: number;
    uploaded_at: string;
  };
  reviewed_by?: string;
  confirmed_by?: string;
};

export function ClinicalWorkspace({ session }: { session: StaffSession }) {
  const { language } = useLocale();
  const text = (zh: string, en: string) => (language === "zh-HK" ? zh : en);
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [selected, setSelected] = useState("");
  const [schedule, setSchedule] = useState<{ time: string; item: string }[]>(
    [],
  );
  const [reason, setReason] = useState("");
  const [documentVerified, setDocumentVerified] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch(apiUrl("/api/workflow"), {
      credentials: "include",
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401)
        window.dispatchEvent(new Event("staff-session-expired"));
      throw new Error(data.error);
    }
    setCases(data.cases);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  const c = cases.find((c) => c.id === selected) || cases.at(-1);
  async function act(action: string) {
    if (!c) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(apiUrl("/api/case-action"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrf || "",
        },
        body: JSON.stringify({
          id: c.id,
          action,
          reason,
          document_id: c.doctor_document?.id,
          document_verified: documentVerified === c.doctor_document?.id,
          ...(action === "schedule_edit" ? { schedule } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 401)
          window.dispatchEvent(new Event("staff-session-expired"));
        throw new Error(data.error);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canReview = !!c && ["PAID", "POSTED", "MATCHED"].includes(c.status);
  const missing = text("未提供", "Not provided");
  const caseStatus = (value: string) =>
    language === "zh-HK"
      ? status[value] || text("待確認", "To confirm")
      : {
          PAID: "Paid",
          POSTED: "Open for matching",
          MATCHED: "Nurse matched",
          READY: "Ready for service",
          IN_SERVICE: "In service",
          DONE: "Completed",
          MANUAL: "Manual review",
          CANCELLED: "Cancelled",
        }[value] || "To confirm";
  const scheduleStatus = (value: string) =>
    ({
      PENDING_REVIEW: text("待護士覆核", "Awaiting nurse review"),
      NURSE_REVIEWED: text("護士已覆核", "Nurse reviewed"),
      CONFIRMED: text("已確認時間表", "Schedule confirmed"),
    })[value] || text("待確認", "To confirm");
  const doctorStatus = (value?: string) =>
    ({
      NA: text("不適用", "Not applicable"),
      YES: text(
        "家屬表示已有，待核對",
        "Reported available; verification required",
      ),
      NO: text("暫未有醫生指示", "Not yet available"),
      UNSURE: text("家屬未能確認", "Unconfirmed"),
      VERIFIED: text("已核對", "Verified"),
    })[value || ""] || missing;
  const dateLabel =
    c?.date && /^\d{4}-\d{2}-\d{2}$/.test(c.date)
      ? new Intl.DateTimeFormat(language, {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "Asia/Hong_Kong",
        }).format(new Date(`${c.date}T12:00:00+08:00`))
      : missing;
  const needsDoctorOrder =
    !!c?.doctor_document ||
    c?.services?.some(
      (service) =>
        service.doctor_order_required ||
        catalog.find((item) => item.id === service.id)?.doctor_order_required,
    ) ||
    (c?.doctor_order && c.doctor_order !== "NA");
  return (
    <div className="email-validation">
      <div className="ev-heading">
        <div>
          <p className="eyebrow">
            CareKnock · {text("資深護士覆核", "Clinical review")}
          </p>
          <h1>{text("護理時間表覆核", "Care schedule review")}</h1>
          <p>
            {text(
              "核對個案、醫生指示及時間表。覆核後由另一位管理員作最終確認。",
              "Review cases, doctor orders and schedules before a separate administrator gives final approval.",
            )}
          </p>
        </div>
      </div>
      {error && (
        <p className="ev-error" role="alert">
          {error}
        </p>
      )}
      <div className="ev-clinical-toolbar">
        <button
          className="button secondary"
          onClick={() => void refresh().catch((e) => setError(e.message))}
        >
          {text("重新整理", "Refresh")}
        </button>
        <label>
          {text("選擇覆核個案", "Select clinical case")}
          <select
            value={c?.id || ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setSchedule([]);
              setReason("");
              setDocumentVerified("");
            }}
          >
            {!c && (
              <option value="">{text("暫未有個案", "No cases yet")}</option>
            )}
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {caseStatus(c.status)} ·{" "}
                {scheduleStatus(c.schedule_status)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {c && (
        <section className="panel ev-panel ev-clinical-case">
          <div className="ev-clinical-title">
            <div>
              <p className="eyebrow">{text("個案", "Case")}</p>
              <h2>{c.id}</h2>
            </div>
            <div className="ev-state">
              <strong>{caseStatus(c.status)}</strong>
              <span>{scheduleStatus(c.schedule_status)}</span>
            </div>
          </div>
          <dl className="ev-clinical-facts">
            <div>
              <dt>{text("服務日期", "Service date")}</dt>
              <dd>{dateLabel}</dd>
            </div>
            <div>
              <dt>{text("服務時間（香港時間）", "Service time (HKT)")}</dt>
              <dd>{c.start && c.end ? `${c.start} – ${c.end}` : missing}</dd>
            </div>
            <div>
              <dt>{text("病人代號", "Patient reference")}</dt>
              <dd>{c.patient_ref || missing}</dd>
            </div>
            <div>
              <dt>{text("年齡", "Age")}</dt>
              <dd>
                {c.age != null && c.age !== ""
                  ? `${c.age}${text(" 歲", " years")}`
                  : c.patient_age_description || missing}
              </dd>
            </div>
            <div>
              <dt>{text("性別", "Gender")}</dt>
              <dd>
                {c.gender === "M"
                  ? text("男", "Male")
                  : c.gender === "F"
                    ? text("女", "Female")
                    : missing}
              </dd>
            </div>
          </dl>
          <section
            className="ev-clinical-section"
            aria-label={text("護理項目", "Care tasks")}
          >
            <h3>{text("護理項目", "Care tasks")}</h3>
            {c.services?.length ? (
              <ul className="ev-clinical-services">
                {c.services.map((service, index) => (
                  <li key={`${service.id || service.label}-${index}`}>
                    <strong>{service.label}</strong>
                    <span>
                      {service.prn
                        ? text("護士自行安排", "Nurse to arrange")
                        : service.times?.length
                          ? service.times.join(" · ")
                          : text("時間待確認", "Time to confirm")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{missing}</p>
            )}
          </section>
          <div className="ev-clinical-notes">
            {c.enquiry_summary && (
              <section>
                <h3>
                  {text(
                    "家屬已核對的 AI 整理摘要（待同事核實）",
                    "Family-reviewed AI summary (staff verification pending)",
                  )}
                </h3>
                <p>{c.enquiry_summary}</p>
                <p>
                  {text("期望時間", "Preferred timing")}:{" "}
                  {c.preferred_timing || missing}
                </p>
              </section>
            )}
            <section>
              <h3>{text("病史", "Medical history")}</h3>
              <p>{c.medical_history?.trim() || missing}</p>
            </section>
            <section>
              <h3>{text("補充資料", "Additional notes")}</h3>
              <p>{c.remarks?.trim() || missing}</p>
            </section>
          </div>
          <section className="ev-clinical-section">
            <h3>{text("醫生指示", "Doctor order")}</h3>
            <p>
              {doctorStatus(
                c.doctor_order_status === "VERIFIED"
                  ? "VERIFIED"
                  : c.doctor_order,
              )}
            </p>
            {c.doctor_order_file && (
              <p>
                {text("文件參考", "Document reference")}: {c.doctor_order_file}
              </p>
            )}
            {needsDoctorOrder && (
              <p>
                {text(
                  c.doctor_document
                    ? "請下載及檢閱家屬上載嘅文件，確認內容符合醫生指示。"
                    : "此個案需要醫生指示，尚未收到上載文件，請跟進。",
                  c.doctor_document
                    ? "Download the uploaded document and verify its contents against the doctor order."
                    : "This case requires a doctor order. No uploaded document is available; follow up before review.",
                )}
              </p>
            )}
            {c.doctor_document && (
              <div className="ev-gates">
                <strong>
                  {text("醫生指示文件版本", "Doctor-order document version")}
                </strong>
                <details>
                  <summary>
                    {text("查看文件版本資料", "View document version details")}
                  </summary>
                  <p>{c.doctor_document.id}</p>
                  <p>SHA-256: {c.doctor_document.sha256}</p>
                </details>
                <a
                  className="button secondary"
                  href={apiUrl(`/api/doctor-document/${c.doctor_document.id}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {text("下載醫生指示文件", "Download doctor-order document")}
                </a>
                <label className="ev-check">
                  <input
                    type="checkbox"
                    checked={documentVerified === c.doctor_document.id}
                    onChange={(e) =>
                      setDocumentVerified(
                        e.target.checked ? c.doctor_document!.id : "",
                      )
                    }
                  />
                  {text(
                    "已檢閱此版本文件並核對醫生指示",
                    "I reviewed this document version and verified the doctor order",
                  )}
                </label>
              </div>
            )}
          </section>
          <section
            className="ev-clinical-section"
            aria-label={text("護理時間表", "Care schedule")}
          >
            <h3>{text("護理時間表", "Care schedule")}</h3>
            {c.schedule?.length ? (
              <div className="ev-clinical-schedule">
                {c.schedule.map((row, index) => (
                  <div key={index}>
                    <time>
                      {row.time === "PRN"
                        ? text("護士自行安排", "Nurse to arrange")
                        : row.time}
                    </time>
                    <span>{row.item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p>
                {text(
                  "尚未建立時間表，請先產生草稿。",
                  "No schedule yet. Generate a draft to begin.",
                )}
              </p>
            )}
          </section>
          {canReview && (
            <>
              <label>
                {text("覆核／修改原因", "Review / edit reason")}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="ev-actions">
                <button
                  className="button secondary"
                  disabled={busy || !canReview || !!c.schedule}
                  onClick={() => void act("draft")}
                >
                  {text("產生規則草稿", "Generate rules draft")}
                </button>
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !canReview ||
                    !c.schedule ||
                    c.schedule_status !== "PENDING_REVIEW"
                  }
                  onClick={() => void act("nurse")}
                >
                  {text("確認資深護士覆核", "Confirm senior nurse review")}
                </button>
                <button
                  className="button secondary"
                  disabled={
                    busy || !canReview || !needsDoctorOrder || !reason.trim()
                  }
                  onClick={() => void act("doctor_failed")}
                >
                  {text(
                    "醫生指示核對失敗，交人手",
                    "Doctor order failed; manual review",
                  )}
                </button>
              </div>
            </>
          )}
          {c.schedule && canReview && (
            <details className="ev-admin">
              <summary>
                {text(
                  "修改時間表（須重新覆核）",
                  "Edit schedule (requires reapproval)",
                )}
              </summary>
              <button
                className="button secondary"
                onClick={() =>
                  setSchedule(c.schedule!.map((row) => ({ ...row })))
                }
              >
                {text("載入現有草稿", "Load draft")}
              </button>
              {schedule.map((row, index) => (
                <div className="ev-clinical-edit-row" key={index}>
                  <label>
                    {text("時間", "Time")} {index + 1}
                    <input
                      type="time"
                      disabled={row.time === "PRN"}
                      value={row.time === "PRN" ? "" : row.time}
                      onChange={(e) =>
                        setSchedule(
                          schedule.map((item, i) =>
                            i === index
                              ? { ...item, time: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    {text("護理項目", "Care task")} {index + 1}
                    <select
                      aria-label={`${text("護理項目", "Care task")} ${index + 1}`}
                      value={row.item}
                      onChange={(e) =>
                        setSchedule(
                          schedule.map((item, i) =>
                            i === index
                              ? { ...item, item: e.target.value }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">{text("請選擇", "Select")}</option>
                      {c.services?.map((service) => (
                        <option key={service.label} value={service.label}>
                          {service.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ev-check">
                    <input
                      type="checkbox"
                      checked={row.time === "PRN"}
                      onChange={(e) =>
                        setSchedule(
                          schedule.map((item, i) =>
                            i === index
                              ? { ...item, time: e.target.checked ? "PRN" : "" }
                              : item,
                          ),
                        )
                      }
                    />
                    {text("護士自行安排", "Nurse to arrange")}
                  </label>
                  <button
                    className="button secondary"
                    aria-label={text(
                      `移除項目 ${index + 1}`,
                      `Remove task ${index + 1}`,
                    )}
                    onClick={() =>
                      setSchedule(schedule.filter((_, i) => i !== index))
                    }
                  >
                    {text("移除", "Remove")}
                  </button>
                </div>
              ))}
              <button
                className="button secondary"
                onClick={() =>
                  setSchedule([...schedule, { time: "", item: "" }])
                }
              >
                {text("新增項目", "Add task")}
              </button>
              <button
                className="button secondary"
                disabled={
                  busy ||
                  !reason.trim() ||
                  !schedule.length ||
                  schedule.some((row) => !row.time || !row.item.trim())
                }
                onClick={() => void act("schedule_edit")}
              >
                {text("記錄修改", "Record edit")}
              </button>
            </details>
          )}
          <p>
            {text("覆核人", "Reviewer")}: {c.reviewed_by || "—"} ·{" "}
            {text("最終批核", "Final approver")}: {c.confirmed_by || "—"}
          </p>
        </section>
      )}
    </div>
  );
}

export function EmailValidation() {
  const { language } = useLocale();
  const text = (zh: string, en: string) => (language === "zh-HK" ? zh : en);
  const { session, logout, error } = useStaffAccess();
  return (
    <>
      <div className="email-validation ev-auth-bar">
        {session.mode === "google" && session.user ? (
          <>
            <span>
              <LockKeyhole size={16} /> {session.user.email} ·{" "}
              {session.user.role === "ADMIN"
                ? text("管理員", "Administrator")
                : text("資深護士", "Senior nurse")}
            </span>
            <button className="button secondary" onClick={() => void logout()}>
              {text("登出", "Sign out")}
            </button>
          </>
        ) : (
          <p>
            {text(
              "本機／共用金鑰演練模式，未啟用個人 Google 登入；此模式不作獨立角色覆核證據。",
              "Local / shared-key rehearsal. Individual Google sign-in is not enabled; this mode is not evidence of independent role review.",
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="ev-error">
            {error}
          </p>
        )}
      </div>
      {session.user?.role === "SENIOR_NURSE" ? (
        <ClinicalWorkspace session={session.user} />
      ) : (
        <AdminWorkspace
          session={session.mode === "google" ? session.user : null}
        />
      )}
    </>
  );
}

export function PublicEmailEnquiry() {
  return <AdminWorkspace session={null} publicIntake />;
}
