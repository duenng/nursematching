import type { Case, Workspace } from "./EmailValidation";

export function DispatchDelivery({
  c,
  workspace,
  zh,
  busy,
  onRetry,
}: {
  c: Case;
  workspace: Workspace;
  zh: boolean;
  busy: boolean;
  onRetry: (id: string) => void;
}) {
  const text = (a: string, b: string) => (zh ? a : b);
  const mails = workspace.emails.filter(
    (m) =>
      m.case_id === c.id &&
      (["T3", "T21", "T16", "T11"].includes(m.template_id) ||
        (m.template_id === "T14" && m.subject.includes("派單預覽"))),
  );
  const dispatches = mails.filter((m) => ["T3", "T21"].includes(m.template_id));
  const eligible = workspace.nurses.filter(
    (n) => n.status === "VERIFIED" && n.registration && n.verified_by,
  );
  const labels: Record<string, string> = {
    T14: text("管理員派單預覽", "Administrator dispatch preview"),
    T3: text("護士接單邀請", "Nurse case invitation"),
    T21: text("護士重新招募", "Nurse recruitment reopened"),
    T16: text("家屬地址填寫通知", "Family address request"),
    T11: text("護士完整服務資料", "Nurse care details"),
  };
  const statuses: Record<string, string> = {
    queued: text("排隊中，未寄出", "Queued, not sent yet"),
    sending: text("正在寄送", "Sending"),
    sent: text("郵件伺服器已接收", "Accepted by mail server"),
    captured: text("只保存於系統，未寄出", "Saved locally, not delivered"),
    blocked: text("未寄出，需處理設定", "Not sent, configuration needed"),
    failed: text("寄送失敗", "Delivery failed"),
    delivery_unknown: text(
      "寄送結果待查，請先核實",
      "Delivery unknown, check before retrying",
    ),
  };
  return (
    <section
      className="ev-dispatch-delivery"
      aria-label={text("派單實際進度", "Dispatch progress")}
    >
      <h3>{text("派單實際進度", "Dispatch progress")}</h3>
      <p>
        {text("可接單護士", "Verified nurses")}: {eligible.length} ·{" "}
        {text("接單邀請紀錄", "Invitation records")}: {dispatches.length} ·{" "}
        {text("郵件伺服器已接收", "Accepted by mail server")}:{" "}
        {dispatches.filter((m) => m.status === "sent").length}
      </p>
      {!dispatches.length && (
        <p className="form-hint">
          {text(
            "尚未建立護士接單邀請。管理員派單預覽不會寄給護士；確認收款後，須按「確認預覽並派單」。",
            "No nurse invitation has been created. The administrator preview is separate; verify payment and approve dispatch to invite nurses.",
          )}
        </p>
      )}
      {dispatches.length > 0 && !c.assigned_nurse && (
        <p>
          {text(
            "尚未有護士確認接單。寄送成功不代表已接單。",
            "No nurse has accepted yet. Email delivery does not confirm acceptance.",
          )}
        </p>
      )}
      {!workspace.capabilities.email_delivery_enabled && (
        <p className="ev-error">
          {text(
            "SMTP 未啟用，家屬及護士不會收到電郵。",
            "SMTP is disabled; families and nurses will not receive emails.",
          )}
        </p>
      )}
      {mails.map((m) => (
        <div className="ev-delivery-record" key={m.id}>
          <strong>
            {labels[m.template_id]} · {statuses[m.status] || m.status}
          </strong>
          <p>{m.to}</p>
          {m.error && <p className="ev-error">{m.error}</p>}
          {["blocked", "failed", "captured"].includes(m.status) && (
            <button
              className="button secondary"
              disabled={busy || !workspace.capabilities.email_delivery_enabled}
              onClick={() => onRetry(m.id)}
            >
              {text("重新寄送", "Retry delivery")}
            </button>
          )}
        </div>
      ))}
      <p className="form-hint">
        {text(
          "郵件伺服器已接收不代表已送達收件箱或已閱讀。被擋或失敗的電郵不會自動重寄。",
          "Mail server acceptance does not confirm inbox delivery or reading. Blocked or failed emails need an explicit retry.",
        )}
      </p>
    </section>
  );
}
