import { useEffect, useState } from "react";
import {
  Mail,
  RefreshCw,
  Download,
  ArrowRight,
  FlaskConical,
  LockKeyhole,
} from "lucide-react";
import { useLocale } from "../i18n";
import "./email-validation.css";
import catalog from "../../server/catalog/services.json";

type Service = { id: string; label: string; times: string[]; prn: boolean };
type Case = {
  id: string;
  surname: string;
  email: string;
  status: string;
  manual_reason?: string;
  red_flag?: boolean;
  date: string;
  start: string;
  end: string;
  district: string;
  building: string;
  quote?: { total: number };
  assigned_nurse?: string;
  address_status: string;
  schedule_status: string;
  schedule?: { time: string; item: string }[];
  payment_deadline?: string;
  order_type?: string;
  package_id?: string;
  refund_status?: string;
  refund_amount?: number;
  remote_tier?: string;
  nurse_pay_total?: number;
  payment_amount?: number;
  payment_review_status?: string;
  services?: { label: string; times: string[]; prn: boolean }[];
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
};
type Workspace = {
  settings: {
    time_scale: number;
    nurse_day_rate: number | null;
    nurse_night_rate: number | null;
    [key: string]: unknown;
  };
  nurses: { id: string; status: string; email: string }[];
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
function AdminWorkspace({
  session,
  publicIntake = false,
}: {
  session: StaffSession | null;
  publicIntake?: boolean;
}) {
  const { language } = useLocale();
  const zh = language === "zh-HK";
  const text = (a: string, b: string) => (zh ? a : b);
  const [key, setKey] = useState(
    () => sessionStorage.getItem("workflow-admin-key") || "",
  );
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [mailId, setMailId] = useState("");
  const [tab, setTab] = useState<
    "cases" | "inbox" | "events" | "ledger" | "acceptance"
  >("cases");
  const [config, setConfig] = useState({
    time_scale: 1,
    nurse_day_rate: "",
    nurse_night_rate: "",
    admin_email: "admin@example.test",
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
    } as Record<string, boolean | string>,
  });
  const [form, setForm] = useState({
    surname: publicIntake ? "" : "陳",
    email: publicIntake ? "" : "family@example.test",
    phone: "",
    district: publicIntake ? "" : "屯門",
    building: publicIntake ? "" : "康樂大廈（虛構）",
    date: publicIntake
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
    gender: publicIntake ? "" : "M",
    age: publicIntake ? "" : "78",
    weight_kg: publicIntake ? "" : "65",
    height_cm: publicIntake ? "" : "165",
    mobility: publicIntake ? "" : "需人輔助",
    companion: publicIntake ? "" : "YES",
    patient_ref: publicIntake ? "" : "TEST-PATIENT-01",
    medical_history: "",
    recent_3m: [] as string[],
    existing_tubes: {} as Record<string, string>,
    doctor_order_file: "",
    intake_version: "v3",
  });
  const [intakeReview, setIntakeReview] = useState(false);
  const [receipt, setReceipt] = useState<{
    id: string;
    status: string;
    quote?: { total: number };
  } | null>(null);
  const [items, setItems] = useState<Service[]>([
    { ...services[0], times: ["12:00"], prn: false },
  ]);
  async function request(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.csrf ? { "X-CSRF-Token": session.csrf } : {}),
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 && session?.method === "google")
        window.dispatchEvent(new Event("staff-session-expired"));
      throw new Error(data.error || "Request failed");
    }
    return data;
  }
  async function refresh(initial = false) {
    const data: Workspace = await request("/api/workflow");
    setWorkspace(data);
    if (initial)
      setConfig({
        time_scale: data.settings.time_scale,
        nurse_day_rate: String(data.settings.nurse_day_rate ?? ""),
        nurse_night_rate: String(data.settings.nurse_night_rate ?? ""),
        admin_email: data.admin_email || "admin@example.test",
        nurses: data.nurses,
        policies: Object.fromEntries(
          Object.keys(config.policies).map((k) => [
            k,
            (data.settings[k] ?? config.policies[k]) as string | boolean,
          ]),
        ),
      });
    return data;
  }
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (!publicIntake) await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!publicIntake) void refresh(true).catch((e) => setError(e.message));
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
            notice: "流程紀錄，並非 TRL 認證或驗收合格報告",
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
    a.download = "trl3-email-evidence.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const [adminReason, setAdminReason] = useState("");
  const [redFlagResolution, setRedFlagResolution] = useState("");
  const [redFlagConfirmed, setRedFlagConfirmed] = useState(false);
  useEffect(() => {
    setRedFlagResolution("");
    setRedFlagConfirmed(false);
  }, [c?.id]);
  const [fps, setFps] = useState({
    submission_id: "",
    bank_reference: "",
    amount: "",
    received_at: "",
    verified: false,
  });
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
        reason: adminReason,
      });
  }

  const [remoteTier, setRemoteTier] = useState("C");
  const [scheduleEdit, setScheduleEdit] = useState("");
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
      ]),
    ];
    const blob = new Blob(
      [
        "\uFEFF" +
          rows
            .map((r) =>
              r
                .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
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
          {form.patient_ref} · {form.surname} · {form.gender} · {form.age} 歲
          <br />
          {form.email} · {form.phone || "—"}
          <br />
          {form.district} {form.building}
          <br />
          {form.date}{" "}
          {form.shift === "DAY"
            ? `${form.start}–${form.end}`
            : form.shift === "NIGHT10"
              ? "22:00–08:00"
              : "22:00–10:00"}
        </p>
        <pre>
          {items
            .map(
              (s) =>
                `${s.label} ${s.prn ? "PRN" : s.times.join("、") || "待補時間"}`,
            )
            .join("\n")}
        </pre>
        <p>
          {text(
            "提交後將由伺服器執行驗證、人工分流及報價。",
            "Server validation, manual routing and quoting follow submission.",
          )}
        </p>
        <div className="ev-actions">
          <button
            autoFocus
            className="button secondary"
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
                    ...(publicIntake ? { fictional: undefined } : {}),
                    services: items,
                  },
                );
                if (publicIntake) setReceipt(result);
                else setSelected(result.id);
                setIntakeReview(false);
              })
            }
          >
            {text("確認提交查詢", "Confirm enquiry submission")}
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
          : text("1. 建立虛構查詢", "1. Create a fictional enquiry")}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setIntakeReview(true);
        }}
      >
        <div className="ev-form-grid">
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
          <label>
            {text("姓氏", "Surname")}
            <input
              required
              value={form.surname}
              onChange={(e) => setForm({ ...form, surname: e.target.value })}
            />
          </label>
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
              <option value="NIGHT10">22:00–08:00</option>
              <option value="NIGHT12">22:00–10:00</option>
            </select>
          </label>
          {form.shift === "DAY" && (
            <>
              <label>
                {text("開始", "Start")}
                <input
                  required
                  type="time"
                  step="1800"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
              </label>
              <label>
                {text("結束", "End")}
                <input
                  required
                  type="time"
                  step="1800"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                />
              </label>
            </>
          )}
        </div>
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
              <div className="ev-service" key={s.id}>
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
                    <input
                      aria-label={`${s.id} times`}
                      placeholder="09:00,12:00,15:00"
                      value={chosen.times.join(",")}
                      disabled={chosen.prn}
                      onChange={(e) =>
                        setItems(
                          items.map((x) =>
                            x.id === s.id
                              ? {
                                  ...x,
                                  times: e.target.value
                                    .split(/[,、]/)
                                    .map((v) => v.trim())
                                    .filter(Boolean),
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
                      PRN
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
            checked={publicIntake ? form.consent : form.fictional}
            onChange={(e) =>
              setForm({
                ...form,
                ...(publicIntake
                  ? { consent: e.target.checked }
                  : { fictional: e.target.checked }),
              })
            }
          />
          {publicIntake
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
          {publicIntake
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
        <div className="ev-heading">
          <div>
            <p className="eyebrow">CareKoala</p>
            <h1>{text("上門護理查詢", "Home nursing enquiry")}</h1>
            <p>
              {text(
                "請填寫真實聯絡資料；查詢會由同事透過電郵跟進。轉帳資料須由管理員人手核對銀行入帳。",
                "Use your real contact details. Staff will follow up by email; bank transfers are independently reconciled by an administrator.",
              )}
            </p>
            <a href="/#staff/email">{text("職員登入", "Staff sign in")}</a>
          </div>
        </div>
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
        {error && (
          <p role="alert" className="ev-error">
            {error}
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
    );

  return (
    <div className="email-validation">
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
      {!!workspace?.capabilities.clock_offset_ms && (
        <p className="ev-error">
          {text(
            "虛擬時鐘實驗：並非真實經過時間",
            "VIRTUAL CLOCK EXPERIMENT: not elapsed wall time",
          )}{" "}
          · {workspace.capabilities.server_now}
        </p>
      )}
      <div className="ev-capabilities">
        <span>
          <Mail size={16} />
          {workspace?.capabilities.email === "smtp_test"
            ? text("SMTP 測試寄信（白名單）", "SMTP test / allowlist")
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
      <details className="panel ev-config">
        <summary>
          <LockKeyhole size={16} />{" "}
          {text("測試設定及管理員連線", "Test settings and admin connection")}
        </summary>
        <p>
          {text(
            "全部測試收件人必須由團隊控制。護士薪酬未確認，請先輸入本次實驗值；有進行中個案時設定會鎖定。",
            "Use team-controlled test recipients. Confirm experimental nurse rates before dispatch. Settings lock while cases are active.",
          )}
        </p>
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
        <div className="ev-form-grid">
          {!session && (
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
          {!session && (
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
            {text("日間護士時薪（測試值）", "Day nurse rate (test)")}
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
            {text("夜間護士時薪（測試值）", "Night nurse rate (test)")}
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
          {Object.entries(config.policies).map(([k, v]) => (
            <label className={typeof v === "boolean" ? "ev-check" : ""} key={k}>
              {typeof v === "boolean" ? (
                <>
                  <input
                    type="checkbox"
                    checked={v}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        policies: { ...config.policies, [k]: e.target.checked },
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
                      allow_arrival_completion: "到達／完成按掣（實驗政策）",
                      package_release: "套餐取消釋放預留時數",
                      notify_others: "通知其他護士已接單",
                    } as Record<string, string>
                  )[k] || k}
                </>
              ) : (
                <>
                  {text("套餐顯示（實驗政策）", "Package offer (experiment)")}
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
          {config.nurses.map((n) => (
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
          disabled={busy}
          onClick={() => run(() => request("/api/settings", config))}
        >
          {text("確認並儲存測試設定", "Confirm test settings")}
        </button>
      </details>
      <div className="ev-toolbar">
        <div role="tablist">
          {(["cases", "inbox", "events", "ledger", "acceptance"] as const).map(
            (t, i) => (
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
            ),
          )}
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => run(() => refresh())}
        >
          <RefreshCw size={15} />
          {text("重新整理", "Refresh")}
        </button>
        <button
          className="button secondary"
          onClick={exportEvidence}
          disabled={!workspace}
        >
          <Download size={15} />
          {text("匯出證據", "Export evidence")}
        </button>
      </div>
      {error && (
        <div className="ev-error" role="alert">
          {error}
        </div>
      )}
      <label className="ev-case-select">
        {text("查看個案", "View case")}
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setMailId("");
          }}
        >
          <option value="">
            {text("全部／最新個案", "All / latest case")}
          </option>
          {workspace?.cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} · {status[c.status] || c.status}
            </option>
          ))}
        </select>
      </label>
      {reviewDialog}
      {tab === "cases" && (
        <div className="ev-columns">
          {intakePanel}
          <section className="panel ev-panel">
            <h2>{text("2. 驗證個案流程", "2. Validate the case flow")}</h2>
            {c ? (
              <>
                <div className="ev-state">
                  <strong>{c.id}</strong>
                  <span>
                    {status[c.status] || c.status} · {c.status}
                  </span>
                </div>
                <p>
                  {c.date} {c.start}–{c.end}
                  <br />
                  {c.district} · {c.building}
                </p>
                {c.quote && <h3>HK${c.quote.total.toLocaleString()}</h3>}
                <div className="ev-gates">
                  <span>
                    {c.order_type || "SINGLE"} · {c.package_id || "—"}
                  </span>
                  <span>
                    {text("偏遠分類", "Remote tier")}: {c.remote_tier || "—"}
                  </span>
                  <span>
                    {text("退款", "Refund")}: {c.refund_status || "—"} · HK$
                    {c.refund_amount ?? 0}
                  </span>
                </div>
                {["bank_transfer", "fps_test"].includes(
                  workspace?.capabilities.payment || "",
                ) && (
                  <section className="ev-gates">
                    <h3>
                      {text(
                        "轉帳對數及退款紀錄",
                        "Transfer reconciliation and refund record",
                      )}
                    </h3>
                    <p>
                      {workspace?.capabilities.payment === "bank_transfer"
                        ? text(
                            "客人提交資料後，請登入銀行核對實際入帳；確認收款前不會派單。系統不會自動查銀行或轉帳。",
                            "Check the actual receipt in your bank after the customer submits a report. Dispatch waits for confirmation; the system does not access your bank or transfer funds.",
                          )
                        : text(
                            "客人提交資料只代表聲明，未確認入帳前不會派單。此為 TRL 3 測試，請用虛構交易。",
                            "A customer report is a claim; dispatch waits for independent bank verification. Use fictional transactions for TRL 3.",
                          )}
                    </p>
                    {workspace?.capabilities.payment === "bank_transfer" &&
                      !workspace.capabilities.bank_transfer_configured && (
                        <p className="ev-error">
                          {text(
                            "收款銀行資料未設定：暫時不能接受付款預約。請在 .env 填寫 BANK_NAME、BANK_ACCOUNT_NAME、BANK_ACCOUNT_NUMBER 後重啟。",
                            "Bank details are not configured. Payment bookings are unavailable until BANK_NAME, BANK_ACCOUNT_NAME and BANK_ACCOUNT_NUMBER are set and the server restarts.",
                          )}
                        </p>
                      )}

                    <p>
                      {text("對數狀態", "Review status")}:{" "}
                      {c.payment_review_status || "—"}
                    </p>
                    <div className="ev-form-grid">
                      <label>
                        {text("待對數轉帳聲明", "Pending transfer report")}
                        <select
                          value={fps.submission_id}
                          onChange={(e) => {
                            const sub = workspace?.payment_submissions.find(
                              (s) => s.id === e.target.value,
                            );
                            setFps({
                              ...fps,
                              submission_id: e.target.value,
                              amount: String(
                                sub?.amount ||
                                  c.payment_amount ||
                                  c.quote?.total ||
                                  "",
                              ),
                            });
                          }}
                        >
                          <option value="">{text("請選擇", "Select")}</option>
                          {workspace?.payment_submissions
                            .filter(
                              (s) =>
                                s.case_id === c.id &&
                                s.status === "PENDING_REVIEW",
                            )
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.reference} · HK${s.amount}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        {text(
                          "銀行入帳／退款轉帳參考",
                          "Bank receipt / refund reference",
                        )}
                        <input
                          value={fps.bank_reference}
                          onChange={(e) =>
                            setFps({ ...fps, bank_reference: e.target.value })
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
                            setFps({ ...fps, amount: e.target.value })
                          }
                        />
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
                            setFps({ ...fps, received_at: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      {text("對數／退款說明", "Reconciliation / refund note")}
                      <textarea
                        value={adminReason}
                        onChange={(e) => setAdminReason(e.target.value)}
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
                      {workspace?.capabilities.payment === "bank_transfer"
                        ? text(
                            "我已登入銀行獨立核對實際入帳／退款，金額及參考正確。",
                            "I independently checked the actual bank receipt or refund, amount and reference.",
                          )
                        : text(
                            "我已獨立核對銀行紀錄，金額及參考正確（測試用虛構銀行紀錄）。",
                            "I independently checked the bank record, amount and reference (fictional bank record for testing).",
                          )}
                    </label>
                    <div className="ev-actions">
                      <button
                        className="button primary"
                        disabled={busy || c.status !== "PENDING_PAY"}
                        onClick={() => run(() => fpsAction("reconcile_fps"))}
                      >
                        {text(
                          "確認銀行入帳，完成對數",
                          "Confirm bank receipt after reconciliation",
                        )}
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy || c.status !== "PENDING_PAY"}
                        onClick={() => run(() => fpsAction("reject_fps"))}
                      >
                        {text(
                          "對數不符，退回跟進",
                          "Reject unmatched transfer report",
                        )}
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy || c.refund_status !== "APPROVED"}
                        onClick={() =>
                          run(() => fpsAction("record_fps_refund"))
                        }
                      >
                        {text(
                          "記錄已完成轉帳退款",
                          "Record completed bank transfer refund",
                        )}
                      </button>
                    </div>
                  </section>
                )}
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
                      value={adminReason}
                      onChange={(e) => setAdminReason(e.target.value)}
                    />
                  </label>
                  {c.red_flag && (
                    <div>
                      <label>
                        {text(
                          "紅旗處置／轉介結果（至少 10 字；未填不可發報價）",
                          "Red-flag resolution / referral (at least 10 characters; required before quoting)",
                        )}
                        <textarea
                          value={redFlagResolution}
                          onChange={(e) => setRedFlagResolution(e.target.value)}
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
                        text("人工處理後發報價", "Issue quote after review"),
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
                      ["reschedule", text("改期交人手", "Manual reschedule")],
                      [
                        "manual_cancel",
                        text("結束未收款人工個案", "Close unpaid manual case"),
                      ],
                      ...(!session
                        ? [
                            [
                              "doctor_failed",
                              text("醫生指示核對失敗", "Doctor order failed"),
                            ],
                          ]
                        : []),
                    ].map(([a, label]) => (
                      <button
                        type="button"
                        disabled={busy}
                        className="button secondary"
                        key={a}
                        onClick={() => run(() => action(a))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="form-hint">
                    {text(
                      "未收款不能派單；退款只可由待批核狀態處理。真人收款／退款不屬本實驗。",
                      "Dispatch needs payment. Refund approval requires a pending request. Live payment/refund is outside this experiment.",
                    )}
                  </p>
                </details>
                {c.status === "MANUAL" && c.manual_reason && (
                  <p className="ev-error">{c.manual_reason}</p>
                )}
                <ol className="ev-steps">
                  <li>
                    {text(
                      "到收件箱開 T1 連結，再在確認頁接受報價。",
                      "Open T1 in the inbox, then confirm acceptance.",
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
                        {text("確認預覽並派單", "Approve preview and dispatch")}
                      </button>
                    </div>
                    <details>
                      <summary>
                        {text(
                          "派單預覽（不含姓名、電話、單位）",
                          "Dispatch preview (no name, phone or unit)",
                        )}
                      </summary>
                      <p>
                        {c.date} {c.start}–{c.end}
                        <br />
                        {c.district} {c.building}
                      </p>
                      <p>
                        {text(
                          "所選護理項目、偏好時間及已確認測試薪酬會列於 T3。",
                          "T3 includes selected care items, times and confirmed test rates.",
                        )}
                      </p>
                    </details>
                  </li>
                  <li>
                    {text(
                      "護士開自己嘅 T3 個人連結，第一個確認接單者得標。",
                      "Nurses open individual T3 links; first confirmation wins.",
                    )}
                  </li>
                  <li>
                    {text(
                      "家屬經 T16 提供單位；完成 Care Schedule 三關。",
                      "Family provides the unit through T16; complete schedule review.",
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
                      {(["draft", "nurse", "admin"] as const).map((step, i) => (
                        <button
                          className="button secondary"
                          key={step}
                          disabled={
                            busy ||
                            (session?.method === "google" &&
                              step === "nurse") ||
                            !["PAID", "POSTED", "MATCHED"].includes(c.status) ||
                            (step === "draft"
                              ? !!c.schedule
                              : step === "nurse"
                                ? !c.schedule ||
                                  c.schedule_status !== "PENDING_REVIEW"
                                : c.schedule_status !== "NURSE_REVIEWED")
                          }
                          onClick={() => run(() => action(step))}
                        >
                          {
                            [
                              text("產生規則草稿", "Generate rules draft"),
                              text("資深護士覆核", "Senior nurse review"),
                              text("Yi 最終確認", "Yi final approval"),
                            ][i]
                          }
                        </button>
                      ))}
                    </div>
                  </li>
                  <li>
                    {text(
                      "配對、地址、排程齊備先寄 T11，轉為 READY。",
                      "T11 is released only after assignment, address and schedule approval.",
                    )}
                  </li>
                </ol>
                <div className="ev-gates">
                  <span>
                    {text("得標護士", "Assigned nurse")}:{" "}
                    {c.assigned_nurse || "—"}
                  </span>
                  <span>
                    {text("地址", "Address")}: {c.address_status}
                  </span>
                  <span>Care Schedule: {c.schedule_status}</span>
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
                        setScheduleEdit(JSON.stringify(c.schedule, null, 2))
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
                    {c.schedule.map((x) => `${x.time} ${x.item}`).join("\n")}
                  </pre>
                )}
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
                <p className="form-hint">
                  {text(
                    "PRN 不設提醒。定時項目提前 10 分鐘提醒，未確認一小時後追問。計時器每分鐘執行一次。",
                    "PRN has no reminders. Timed tasks notify 10 minutes before, with a one-hour follow-up. Worker runs every minute.",
                  )}
                </p>
              </>
            ) : (
              <p>{text("建立個案開始驗證。", "Create a case to begin.")}</p>
            )}
          </section>
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
                <strong>
                  {m.template_id} · {m.to}
                </strong>
                <span>{m.subject}</span>
                <small>{m.status}</small>
              </button>
            ))}
          </section>
          <section className="panel ev-panel">
            {mail ? (
              <>
                <p>
                  {mail.template_id} · {mail.template_version} · {mail.status}
                </p>
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
          {workspace?.payouts.map((p) => (
            <p key={p.id}>
              {p.case_id} · {p.nurse_id} · HK${p.total} · {p.status}
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
                <p key={id}>
                  {id} · {t.scope} · {t.description}
                </p>
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

type StaffSession = {
  id: string;
  email?: string;
  role: "ADMIN" | "SENIOR_NURSE";
  method: "google" | "shared_key" | "loopback";
  csrf?: string;
};
type SessionInfo = {
  mode: "google" | "local";
  user: StaffSession | null;
  login_url: string | null;
};
type ClinicalCase = Case & {
  patient_ref?: string;
  age?: number;
  gender?: string;
  medical_history?: string;
  remarks?: string;
  doctor_order?: string;
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

function ClinicalWorkspace({ session }: { session: StaffSession }) {
  const { language } = useLocale();
  const text = (zh: string, en: string) => (language === "zh-HK" ? zh : en);
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [selected, setSelected] = useState("");
  const [schedule, setSchedule] = useState("");
  const [reason, setReason] = useState("");
  const [documentVerified, setDocumentVerified] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch("/api/workflow");
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
      const r = await fetch("/api/case-action", {
        method: "POST",
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
          ...(action === "schedule_edit"
            ? { schedule: JSON.parse(schedule) }
            : {}),
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
  return (
    <div className="email-validation">
      <div className="ev-heading">
        <div>
          <p className="eyebrow">
            TRL 3 · {text("資深護士覆核", "Clinical review")}
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
            setSchedule("");
            setReason("");
          }}
        >
          {!c && <option value="">{text("暫未有個案", "No cases yet")}</option>}
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} · {c.status} · {c.schedule_status}
            </option>
          ))}
        </select>
      </label>
      {c && (
        <section className="panel ev-panel">
          <h2>
            {c.id} · {c.patient_ref}
          </h2>
          <div className="ev-state">
            <strong>{c.status}</strong>
            <span>{c.schedule_status}</span>
          </div>
          <p>
            {c.date} {c.start}–{c.end} · {text("年齡", "Age")} {c.age ?? "—"} ·{" "}
            {c.gender}
          </p>
          <pre>
            {JSON.stringify(
              {
                patient_ref: c.patient_ref,
                services: c.services,
                medical_history: c.medical_history,
                remarks: c.remarks,
                doctor_order: c.doctor_order,
                doctor_order_file: c.doctor_order_file,
              },
              null,
              2,
            )}
          </pre>
          <p>
            {text(
              "請下載及檢閱家屬上載嘅醫生指示文件。系統記錄文件版本，內容必須由護士核對。",
              "Download and review the uploaded doctor-order document. The system records the file version; a nurse must verify its contents.",
            )}
          </p>
          {c.doctor_document && (
            <div className="ev-gates">
              <strong>
                {text("醫生指示文件版本", "Doctor-order document version")}
              </strong>
              <span>{c.doctor_document.id}</span>
              <span>SHA-256: {c.doctor_document.sha256}</span>
              <a
                className="button secondary"
                href={`/api/doctor-document/${c.doctor_document.id}`}
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
          {c.schedule && (
            <pre>{c.schedule.map((r) => `${r.time} ${r.item}`).join("\n")}</pre>
          )}
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
              disabled={busy || !canReview || !reason.trim()}
              onClick={() => void act("doctor_failed")}
            >
              {text(
                "醫生指示核對失敗，交人手",
                "Doctor order failed; manual review",
              )}
            </button>
          </div>
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
                onClick={() => setSchedule(JSON.stringify(c.schedule, null, 2))}
              >
                {text("載入現有草稿", "Load draft")}
              </button>
              <label>
                {text("時間表 JSON", "Schedule JSON")}
                <textarea
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                />
              </label>
              <button
                className="button secondary"
                disabled={busy || !reason.trim()}
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
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState("");
  async function load() {
    const r = await fetch("/auth/session");
    if (!r.ok)
      throw new Error(
        text(
          "登入服務未能連線，請啟動 API 伺服器。",
          "Cannot reach login service. Start the API server.",
        ),
      );
    setSession(await r.json());
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const expired = () => {
      setSession(null);
      void load().catch((e) => setError(e.message));
    };
    window.addEventListener("staff-session-expired", expired);
    return () => window.removeEventListener("staff-session-expired", expired);
  }, []);
  async function logout() {
    try {
      const r = await fetch("/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": session?.user?.csrf || "" },
      });
      if (!r.ok)
        throw new Error(
          text(
            "登出失敗，請重新整理。",
            "Logout failed. Refresh and try again.",
          ),
        );
      setSession(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!session || (session.mode === "google" && !session.user))
    return (
      <section className="email-validation panel ev-panel">
        <LockKeyhole size={28} />
        <h1>{text("職員登入", "Staff sign in")}</h1>
        <p>
          {text(
            "使用獲准嘅 Google／Workspace 職員帳戶進入電郵流程驗證台。",
            "Use an approved Google / Workspace staff account to enter the email validation workspace.",
          )}
        </p>
        {error && (
          <p role="alert" className="ev-error">
            {error}
          </p>
        )}
        {session?.login_url && (
          <a className="button primary" href={session.login_url}>
            {text("使用 Google 登入", "Sign in with Google")}
          </a>
        )}
        {!session && (
          <button
            className="button secondary"
            onClick={() => void load().catch((e) => setError(e.message))}
          >
            {text("重新連線", "Retry connection")}
          </button>
        )}
      </section>
    );
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
