import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  FolderHeart,
  HeartHandshake,
  LayoutDashboard,
  Mail,
  Menu,
  MessageCircle,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import { Logo } from "../components";
import { EmailPreview } from "../EmailPreview";
import { LanguageSwitcher, useLocale } from "../i18n";
import { useStaffAccess } from "../StaffAccess";
import { apiUrl } from "../lib/api";
import { AdminWorkspace, ClinicalWorkspace } from "./EmailValidation";
import type { Workspace, Case } from "./EmailValidation";
import "./staff-workspace.css";

const pages = [
  ["overview", "總覽", "Overview", LayoutDashboard],
  ["enquiries", "護理查詢", "Care enquiries", MessageCircle],
  ["requests", "護理個案", "Care requests", ClipboardList],
  ["schedule", "護理排程", "Care schedule", CalendarDays],
  ["providers", "護理人員", "Care providers", HeartHandshake],
  ["messages", "電郵通知", "Messages", Mail],
  ["clients", "客戶紀錄", "Client records", FolderHeart],
  ["ledger", "套餐及薪酬帳", "Ledgers", FolderHeart],
  ["settings", "設定", "Settings", Settings],
] as const;
const statuses: Record<string, [string, string]> = {
  SUBMITTED: ["已提交", "Submitted"],
  MANUAL: ["待人工處理", "Manual review"],
  QUOTED: ["已報價", "Quoted"],
  PENDING_PAY: ["待核實付款", "Awaiting payment"],
  PAID: ["已收款", "Paid"],
  POSTED: ["招募中", "Open for matching"],
  MATCHED: ["已配對", "Matched"],
  READY: ["待服務", "Ready"],
  IN_SERVICE: ["服務中", "In service"],
  DONE: ["已完成", "Completed"],
  CANCELLED: ["已取消", "Cancelled"],
  PAY_TIMEOUT: ["付款逾時", "Payment expired"],
  EXPIRED: ["報價失效", "Quote expired"],
  FULL_REFUND: ["待退款", "Refund pending"],
  REMATCH: ["重新配對", "Rematching"],
  NO_DR_ORDER: ["缺醫生指示", "Doctor order needed"],
  NO_FIRST_INSERT: ["不提供首次插喉", "First insertion unavailable"],
  APPLIED: ["待核實資格", "Awaiting verification"],
  VERIFIED: ["資格已核實", "Verified"],
  SUSPENDED: ["已暫停", "Suspended"],
  BLACKLISTED: ["已取消資格", "Blacklisted"],
  queued: ["排隊中", "Queued"],
  captured: ["已保存，未寄出", "Saved, not delivered"],
  sent: ["郵件伺服器已接收", "Accepted by mail server"],
  failed: ["寄送失敗", "Delivery failed"],
  blocked: ["未寄出，需處理設定", "Not sent, configuration needed"],
  delivery_unknown: ["寄送結果待查", "Delivery unknown"],
  sending: ["正在寄送", "Sending"],
};
const blankNurse = {
  id: "",
  name: "",
  email: "",
  category: "RN",
  registration: "",
  verification_note: "",
  status: "APPLIED",
  credentials_verified: false,
};
function route() {
  const [, raw = "overview", caseId = ""] = window.location.hash.split("/");
  return {
    page:
      raw === "email"
        ? "requests"
        : pages.some(([id]) => id === raw)
          ? raw
          : "overview",
    caseId,
  };
}
export function StaffWorkspace() {
  const { language } = useLocale();
  const zh = language === "zh-HK";
  const text = (a: string, b: string) => (zh ? a : b);
  const { session, logout, error: authError } = useStaffAccess();
  const staff = session.user!;
  const clinical = staff.role === "SENIOR_NURSE";
  const [location, setLocation] = useState(route);
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [day, setDay] = useState("");
  const [mobile, setMobile] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [nurse, setNurse] = useState(blankNurse);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const sequence = useRef(0);
  const status = (s: string) => statuses[s]?.[zh ? 0 : 1] || s;
  const stamp = (s: string) =>
    new Date(s).toLocaleString(zh ? "zh-HK" : "en-HK", {
      timeZone: "Asia/Hong_Kong",
    });
  const request = useCallback(
    async (path: string, input?: unknown) => {
      const key = sessionStorage.getItem("workflow-admin-key");
      const response = await fetch(apiUrl(path), {
        credentials: "include",
        cache: "no-store",
        method: input === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(staff.csrf ? { "X-CSRF-Token": staff.csrf } : {}),
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401)
          window.dispatchEvent(new Event("staff-session-expired"));
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      return result;
    },
    [staff.csrf],
  );
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    try {
      const result = await request("/api/workflow");
      if (id !== sequence.current) return;
      setData(result);
      setUpdatedAt(new Date().toISOString());
      setError("");
    } catch (e) {
      if (id === sequence.current) setError((e as Error).message);
    }
  }, [request]);
  useEffect(() => {
    const change = () => {
      setLocation(route());
      setQuery("");
      setFilter("");
      setMobile(false);
      setNotice("");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (clinical) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    window.addEventListener("staff-workflow-updated", focus);
    return () => {
      sequence.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("staff-workflow-updated", focus);
    };
  }, [refresh, clinical]);
  const go = (page: string, id = "") => {
    window.location.hash = `staff/${page}${id ? `/${id}` : ""}`;
  };
  const openCase = (id: string) => go("requests", id);
  const cases = (data?.cases || []).filter(
    (c) =>
      `${c.id} ${c.surname} ${c.patient_ref} ${c.email} ${c.district} ${c.building}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filter || c.status === filter),
  );
  const page = location.page;
  const title = pages.find(([id]) => id === page)!;
  const empty = (
    message = text(
      "尚未有紀錄。新增查詢後，資料會在這裡顯示。",
      "No records yet. New enquiries will appear here.",
    ),
  ) => <p className="staff-empty">{message}</p>;
  function caseTable(records: Case[]) {
    return records.length ? (
      <div className="staff-table">
        <table>
          <thead>
            <tr>
              {[
                text("個案／病人代號", "Case / patient reference"),
                text("聯絡人", "Contact"),
                text("服務時間（香港）", "Service time (Hong Kong)"),
                text("地區", "District"),
                text("狀態", "Status"),
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((c) => (
              <tr key={c.id}>
                <td>
                  <button
                    className="staff-text-button"
                    onClick={() => openCase(c.id)}
                  >
                    {c.id}
                  </button>
                  <small>{c.patient_ref || "—"}</small>
                </td>
                <td>
                  {c.surname}
                  <small>{c.email}</small>
                </td>
                <td>
                  {c.date}
                  <small>
                    {c.start}–{c.end}
                    {c.end < c.start ? text("（翌日）", " (+1 day)") : ""}
                  </small>
                </td>
                <td>{c.district}</td>
                <td>
                  <span className="badge">{status(c.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      empty()
    );
  }
  async function retryMail(id: string) {
    setBusy(true);
    setError("");
    try {
      await request("/api/email-retry", { id });
      setNotice(text("已重新排入寄信佇列。", "Notification queued for retry."));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProvider(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/nurses", nurse);
      setEditing(false);
      setNurse(blankNurse);
      setNotice(
        text("護理員資料已儲存在伺服器。", "Provider saved on the server."),
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const operational = data?.capabilities.workspace !== "test";
  return (
    <div className="app-shell staff-live">
      {mobile && (
        <button
          aria-label={text("關閉選單", "Close menu")}
          className="sidebar-scrim"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a href="#staff/overview" className="brand-button">
          <Logo />
        </a>
        <p className="nav-label">{text("職員工作區", "STAFF WORKSPACE")}</p>
        <nav aria-label={text("主選單", "Main navigation")}>
          {pages
            .filter(
              ([id]) => !clinical || ["requests", "schedule"].includes(id),
            )
            .map(([id, z, en, Icon]) => (
              <button
                key={id}
                className={`nav-item ${page === id ? "active" : ""}`}
                onClick={() => go(id)}
              >
                <Icon size={19} />
                <span>{text(z, en)}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom staff-identity">
          <strong>
            {text(
              clinical ? "資深護士" : "管理員",
              clinical ? "Senior nurse" : "Administrator",
            )}
          </strong>
          <small>{staff.email || staff.id}</small>
          <button className="button secondary" onClick={() => void logout()}>
            {text("登出", "Sign out")}
          </button>
          <a href="#patient">{text("返回網站", "Public website")}</a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label={text("開啟選單", "Open menu")}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <strong>{text(title[1], title[2])}</strong>
          </div>
          <LanguageSwitcher />
        </header>
        <main className="staff-content">
          {(error || authError) && (
            <div role="alert" className="ev-error">
              {error || authError}
              <button
                className="button secondary"
                onClick={() => void refresh()}
              >
                {text("重試", "Retry")}
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="staff-notice">
              {notice}
            </p>
          )}
          {clinical ? (
            <ClinicalWorkspace session={staff} />
          ) : (
            <>
              <div className="ev-heading">
                <div>
                  <p className="eyebrow">
                    CareKnock · {text("香港時間", "Hong Kong time")}
                  </p>
                  <h1>{text(title[1], title[2])}</h1>
                  {!location.caseId && (
                    <p>
                      {text(
                        "共用伺服器紀錄，操作按職員權限保存。",
                        "Shared server records with staff permissions and an audit trail.",
                      )}
                    </p>
                  )}
                </div>
                <button
                  className="button secondary"
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={16} />
                  {text("重新整理", "Refresh")}
                </button>
              </div>
              {!data ? (
                <p role="status">
                  {error
                    ? text(
                        "無法載入資料，請重試。",
                        "Unable to load records. Please retry.",
                      )
                    : text("正在載入伺服器紀錄…", "Loading server records…")}
                </p>
              ) : (
                <>
                  {!data.capabilities.email_delivery_enabled && (
                    <div className="staff-notice">
                      {text(
                        "電郵寄送尚未啟用：通知只會儲存在系統，家屬及護士不會收到電郵。請在設定查看連線狀態。",
                        "Email delivery is not enabled. Notifications are saved in the system; families and nurses will not receive them. See Settings for connection status.",
                      )}
                    </div>
                  )}
                  {!operational && (
                    <div className="staff-notice">
                      {text(
                        "目前伺服器使用測試模式，付款及收件人受測試設定限制。",
                        "This server is in test mode. Payments and recipients follow test settings.",
                      )}
                    </div>
                  )}
                  {page === "overview" && (
                    <>
                      <div className="staff-stats">
                        {[
                          [
                            text("待人工處理", "Needs attention"),
                            data.cases.filter((c) =>
                              ["MANUAL", "NO_DR_ORDER", "FULL_REFUND"].includes(
                                c.status,
                              ),
                            ).length,
                            "requests",
                          ],
                          [
                            text("待核實付款", "Awaiting payment"),
                            data.cases.filter((c) => c.status === "PENDING_PAY")
                              .length,
                            "requests",
                          ],
                          [
                            text("已安排服務", "Scheduled services"),
                            data.cases.filter((c) =>
                              ["MATCHED", "READY", "IN_SERVICE"].includes(
                                c.status,
                              ),
                            ).length,
                            "schedule",
                          ],
                          [
                            text("已核實護理員", "Verified providers"),
                            data.nurses.filter((n) => n.status === "VERIFIED")
                              .length,
                            "providers",
                          ],
                        ].map(([label, count, target]) => (
                          <button
                            className="panel"
                            key={label}
                            onClick={() => go(String(target))}
                          >
                            <span>{label}</span>
                            <strong>{count}</strong>
                          </button>
                        ))}
                      </div>
                      <section className="panel ev-panel">
                        <div className="staff-section-title">
                          <h2>{text("最近查詢", "Recent enquiries")}</h2>
                          <button
                            className="button primary"
                            onClick={() => go("enquiries")}
                          >
                            {text("新增查詢", "New enquiry")}
                          </button>
                        </div>
                        {caseTable(data.cases.slice(-8).reverse())}
                      </section>
                      <section className="panel ev-panel">
                        <h2>{text("需跟進的電郵", "Email delivery issues")}</h2>
                        {data.emails.filter((m) =>
                          ["failed", "blocked", "delivery_unknown"].includes(
                            m.status,
                          ),
                        ).length ? (
                          <button
                            className="button secondary"
                            onClick={() => go("messages")}
                          >
                            {text("查看寄送問題", "Review delivery issues")}
                          </button>
                        ) : (
                          empty(
                            text(
                              "目前沒有寄送失敗紀錄。",
                              "No delivery failures recorded.",
                            ),
                          )
                        )}
                      </section>
                    </>
                  )}
                  {["requests", "schedule", "clients"].includes(page) &&
                    !location.caseId && (
                      <div className="staff-filters">
                        <label>
                          <Search size={16} />
                          <input
                            aria-label={text("搜尋工作區", "Search workspace")}
                            placeholder={text(
                              "個案、電郵、病人代號或地區",
                              "Case, email, patient reference or district",
                            )}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </label>
                        <select
                          aria-label={text("個案狀態", "Case status")}
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        >
                          <option value="">
                            {text("所有狀態", "All statuses")}
                          </option>
                          {Array.from(
                            new Set(data.cases.map((c) => c.status)),
                          ).map((s) => (
                            <option value={s} key={s}>
                              {status(s)}
                            </option>
                          ))}
                        </select>
                        {page === "schedule" && (
                          <input
                            aria-label={text("服務日期", "Service date")}
                            type="date"
                            value={day}
                            onChange={(e) => setDay(e.target.value)}
                          />
                        )}
                      </div>
                    )}
                  {page === "requests" && !location.caseId && (
                    <section className="panel ev-panel">
                      {caseTable(cases.slice().reverse())}
                    </section>
                  )}
                  {((page === "requests" && location.caseId) ||
                    ["enquiries", "settings", "ledger"].includes(page)) && (
                    <>
                      {location.caseId && (
                        <button
                          className="button secondary"
                          onClick={() => go("requests")}
                        >
                          {text("返回全部個案", "Back to all cases")}
                        </button>
                      )}
                      {location.caseId &&
                      !data.cases.some((c) => c.id === location.caseId) ? (
                        empty(text("找不到此個案。", "Case not found."))
                      ) : (
                        <AdminWorkspace
                          key={`${page}/${location.caseId}`}
                          session={staff}
                          operational
                          section={page}
                          initialCaseId={location.caseId}
                        />
                      )}
                    </>
                  )}
                  {page === "schedule" && (
                    <section className="panel ev-panel">
                      <h2>{text("服務安排", "Service arrangements")}</h2>
                      <p>
                        {text(
                          "只顯示已收款或已配對的個案；正式服務需完成護士覆核、管理員批核及地址確認。",
                          "Shows paid or matched cases. Service readiness requires nurse review, administrator approval and a confirmed address.",
                        )}
                      </p>
                      {caseTable(
                        cases
                          .filter(
                            (c) =>
                              [
                                "PAID",
                                "POSTED",
                                "MATCHED",
                                "READY",
                                "IN_SERVICE",
                                "DONE",
                                "REMATCH",
                              ].includes(c.status) &&
                              (!day || c.date === day),
                          )
                          .sort((a, b) =>
                            `${a.date}${a.start}`.localeCompare(
                              `${b.date}${b.start}`,
                            ),
                          ),
                      )}
                    </section>
                  )}
                  {page === "clients" && (
                    <section className="panel ev-panel">
                      <h2>
                        {text(
                          "按聯絡電郵及病人代號查看",
                          "Records by contact email and patient reference",
                        )}
                      </h2>
                      <p>
                        {text(
                          "同一家庭可有不同病人；不同代號的紀錄分開顯示。",
                          "A family may have multiple patients; different references are shown separately.",
                        )}
                      </p>
                      {Array.from(
                        new Set(
                          cases.map((c) =>
                            JSON.stringify([c.email, c.patient_ref]),
                          ),
                        ),
                      ).map((key) => {
                        const [email, ref] = JSON.parse(key);
                        const records = cases.filter(
                          (c) => c.email === email && c.patient_ref === ref,
                        );
                        return (
                          <details className="staff-client" key={key}>
                            <summary>
                              {ref || text("未提供代號", "No reference")} ·{" "}
                              {email} · {records.length}
                            </summary>
                            {caseTable(records)}
                          </details>
                        );
                      })}
                      {!cases.length && empty()}
                    </section>
                  )}
                  {page === "providers" && (
                    <section className="panel ev-panel">
                      <div className="staff-section-title">
                        <h2>{text("護理員名冊", "Provider directory")}</h2>
                        <button
                          className="button primary"
                          onClick={() => {
                            setNurse(blankNurse);
                            setEditing(true);
                          }}
                        >
                          {text("新增護理員", "Add provider")}
                        </button>
                      </div>
                      <p>
                        {text(
                          "只有經管理員核實資格並啟用的護理員才可接單。暫停不會自動取消已安排的服務。",
                          "Only providers whose credentials have been verified and activated can accept cases. Suspension does not automatically cancel assigned care.",
                        )}
                      </p>
                      {data.nurses.length ? (
                        <div className="staff-table">
                          <table>
                            <thead>
                              <tr>
                                {[
                                  text("姓名", "Name"),
                                  text("電郵", "Email"),
                                  text("資格", "Qualification"),
                                  text("狀態", "Status"),
                                  text("操作", "Action"),
                                ].map((h) => (
                                  <th key={h}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {data.nurses.map((n) => (
                                <tr key={n.id}>
                                  <td>{n.name || n.id}</td>
                                  <td>{n.email}</td>
                                  <td>
                                    {n.category || "—"}
                                    <small>{n.registration || "—"}</small>
                                  </td>
                                  <td>{status(n.status)}</td>
                                  <td>
                                    <button
                                      className="button secondary"
                                      disabled={n.status === "BLACKLISTED"}
                                      onClick={() => {
                                        setNurse({
                                          ...blankNurse,
                                          ...n,
                                          name: n.name || "",
                                          category: n.category || "RN",
                                          registration: n.registration || "",
                                          verification_note:
                                            n.verification_note || "",
                                          credentials_verified: false,
                                        });
                                        setEditing(true);
                                      }}
                                    >
                                      {text("編輯", "Edit")}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        empty(
                          text(
                            "尚未加入護理員。請新增並核實真實人員的資格。",
                            "No providers yet. Add a provider and verify their credentials.",
                          ),
                        )
                      )}
                    </section>
                  )}
                  {page === "messages" && (
                    <section className="panel ev-panel">
                      <h2>{text("電郵寄送紀錄", "Email delivery log")}</h2>
                      <p>
                        {text(
                          "「郵件伺服器已接收」不代表收件人已閱讀。家屬及護士須使用各自電郵中的連結確認操作。",
                          "Acceptance by the mail server does not confirm that the recipient has read it. Families and nurses confirm actions through their own email links.",
                        )}
                      </p>
                      {data.emails
                        .slice()
                        .reverse()
                        .map((m) => (
                          <details className="staff-client" key={m.id}>
                            <summary>
                              {m.subject} · {status(m.status)}
                            </summary>
                            <p>
                              {m.to} ·{" "}
                              <button
                                className="staff-text-button"
                                onClick={() => openCase(m.case_id)}
                              >
                                {m.case_id}
                              </button>
                            </p>
                            {m.error && (
                              <p role="alert" className="ev-error">
                                {m.error}
                              </p>
                            )}
                            <EmailPreview mail={m} />
                            <details className="ev-email-plain">
                              <summary>
                                {text("純文字內容", "Plain text content")}
                              </summary>
                              <pre>{m.body}</pre>
                            </details>
                            {["failed", "blocked", "captured"].includes(
                              m.status,
                            ) && (
                              <button
                                className="button secondary"
                                disabled={
                                  busy ||
                                  !data.capabilities.email_delivery_enabled
                                }
                                onClick={() => void retryMail(m.id)}
                              >
                                {text("重新寄送", "Retry delivery")}
                              </button>
                            )}
                          </details>
                        ))}
                      {!data.emails.length &&
                        empty(
                          text("尚未有電郵通知。", "No notifications yet."),
                        )}
                    </section>
                  )}
                  {page === "settings" && (
                    <section className="panel ev-panel">
                      <h2>
                        {text(
                          "連線狀態與操作紀錄",
                          "Connections and audit trail",
                        )}
                      </h2>
                      <dl className="staff-connections">
                        <dt>{text("資料儲存", "Storage")}</dt>
                        <dd>SQLite · {text("伺服器", "Server")}</dd>
                        <dt>{text("登入方式", "Authentication")}</dt>
                        <dd>
                          {staff.method === "google"
                            ? "Google"
                            : text("本機／共用金鑰", "Local / shared key")}
                        </dd>
                        <dt>{text("電郵", "Email")}</dt>
                        <dd>
                          {data.capabilities.email}
                          {data.capabilities.email_restricted
                            ? text(
                                "（收件人有限制）",
                                " (restricted recipients)",
                              )
                            : ""}
                        </dd>
                        <dt>
                          {text("銀行收款資料", "Receiving bank account")}
                        </dt>
                        <dd>
                          {text(
                            data.capabilities.bank_transfer_configured
                              ? "已設定"
                              : "尚未設定",
                            data.capabilities.bank_transfer_configured
                              ? "Configured"
                              : "Not configured",
                          )}
                        </dd>
                      </dl>
                      <p>
                        {text(
                          "未設定的連線需由部署管理員完成 SMTP、銀行帳戶及 Google 職員名單設定。",
                          "The deployment administrator configures SMTP, the receiving bank account and Google staff allowlists.",
                        )}
                      </p>
                      <details>
                        <summary>
                          {text("最近操作紀錄", "Recent audit events")}
                        </summary>
                        <div className="staff-table">
                          <table>
                            <thead>
                              <tr>
                                <th>
                                  {text("時間（香港）", "Time (Hong Kong)")}
                                </th>
                                <th>{text("職員", "Staff")}</th>
                                <th>{text("事件", "Event")}</th>
                                <th>{text("個案", "Case")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.events
                                .slice(-100)
                                .reverse()
                                .map((e) => (
                                  <tr key={e.id}>
                                    <td>{stamp(e.at)}</td>
                                    <td>
                                      {e.actor_code || e.actor || "system"}
                                    </td>
                                    <td>{e.event}</td>
                                    <td>{e.case_id || "—"}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </section>
                  )}
                  <footer className="content-footer">
                    {text("最近同步", "Last synced")}:{" "}
                    {updatedAt ? stamp(updatedAt) : "—"} ·{" "}
                    {text("香港時間", "Hong Kong time")}
                  </footer>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {editing && (
        <div className="ev-review-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={text("護理員資料", "Provider details")}
            className="panel ev-panel ev-review email-validation"
          >
            <div className="staff-section-title">
              <h2>{text("護理員資料", "Provider details")}</h2>
              <button
                aria-label={text("關閉", "Close")}
                className="icon-button"
                onClick={() => setEditing(false)}
              >
                <X />
              </button>
            </div>
            {error && (
              <p className="ev-error" role="alert">
                {error}
              </p>
            )}
            <form onSubmit={saveProvider}>
              <div className="ev-form-grid">
                {(
                  [
                    ["name", "姓名", "Name"],
                    ["email", "電郵", "Email"],
                    ["registration", "註冊編號", "Registration number"],
                  ] as const
                ).map(([key, z, en]) => (
                  <label key={key}>
                    {text(z, en)}
                    <input
                      autoFocus={key === "name"}
                      required={
                        key !== "registration" || nurse.status === "VERIFIED"
                      }
                      type={key === "email" ? "email" : "text"}
                      value={nurse[key]}
                      onChange={(e) =>
                        setNurse({ ...nurse, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  {text("類別", "Category")}
                  <select
                    value={nurse.category}
                    onChange={(e) =>
                      setNurse({ ...nurse, category: e.target.value })
                    }
                  >
                    <option>RN</option>
                    <option>EN</option>
                  </select>
                </label>
                <label>
                  {text("狀態", "Status")}
                  <select
                    value={nurse.status}
                    onChange={(e) =>
                      setNurse({
                        ...nurse,
                        status: e.target.value,
                        credentials_verified: false,
                      })
                    }
                  >
                    {["APPLIED", "VERIFIED", "SUSPENDED"].map((s) => (
                      <option value={s} key={s}>
                        {status(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {text("資格核實紀錄／備註", "Verification record / notes")}
                <textarea
                  required={nurse.status === "VERIFIED"}
                  value={nurse.verification_note}
                  onChange={(e) =>
                    setNurse({ ...nurse, verification_note: e.target.value })
                  }
                />
              </label>
              {nurse.status === "VERIFIED" && (
                <label className="ev-check">
                  <input
                    required
                    type="checkbox"
                    checked={nurse.credentials_verified}
                    onChange={(e) =>
                      setNurse({
                        ...nurse,
                        credentials_verified: e.target.checked,
                      })
                    }
                  />
                  {text(
                    "我已核對註冊資格及有效文件，確認可啟用接單。",
                    "I checked the registration and valid credentials and approve activation.",
                  )}
                </label>
              )}
              <button className="button primary" disabled={busy}>
                {busy
                  ? text("儲存中…", "Saving…")
                  : text("儲存護理員", "Save provider")}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
