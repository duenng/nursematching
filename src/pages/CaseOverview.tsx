import { CalendarDays, MapPin, UserRound } from "lucide-react";
import type { Case } from "./EmailValidation";

export function caseStatusLabel(value: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    QUOTED: ["已報價", "Quote sent"],
    PENDING_PAY: ["待付款", "Awaiting payment"],
    PAID: ["已付款", "Payment verified"],
    POSTED: ["已派單", "Recruiting nurse"],
    MATCHED: ["已配對", "Nurse assigned"],
    READY: ["待服務", "Ready for service"],
    IN_SERVICE: ["服務中", "In service"],
    DONE: ["已完成", "Completed"],
    REMATCH: ["重新配對", "Finding another nurse"],
    FULL_REFUND: ["退款處理中", "Refund in progress"],
    EXPIRED: ["報價失效", "Quote expired"],
    MANUAL: ["待人工處理", "Needs review"],
    PAY_TIMEOUT: ["付款逾時", "Payment overdue"],
    CANCELLED: ["已取消", "Cancelled"],
    NO_DR_ORDER: ["缺少醫生指示", "Doctor order needed"],
    NO_FIRST_INSERT: ["不提供首次插喉", "First insertion unavailable"],
  };
  return labels[value]?.[zh ? 0 : 1] || value;
}

export function refundStatusLabel(value: string | undefined, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    PENDING: ["待批核", "Awaiting approval"],
    APPROVED: ["已批核，待轉帳", "Approved, awaiting transfer"],
    DONE: ["已完成", "Completed"],
  };
  return (
    labels[value || ""]?.[zh ? 0 : 1] ||
    value ||
    (zh ? "沒有退款紀錄" : "No refund recorded")
  );
}

export function CaseOverview({
  c,
  zh,
  pendingReports,
}: {
  c: Case;
  zh: boolean;
  pendingReports: number;
}) {
  const text = (a: string, b: string) => (zh ? a : b);
  const closed = [
    "CANCELLED",
    "EXPIRED",
    "PAY_TIMEOUT",
    "DONE",
    "NO_FIRST_INSERT",
  ].includes(c.status);
  const guidance: Record<string, [string, string]> = {
    MANUAL: [
      "核實服務資料，再打開下方「人工覆核」處理報價或結束個案。",
      "Verify the service details, then open manual review below to prepare a quote or close the case.",
    ],
    QUOTED: [
      "等候家屬透過報價電郵接受報價。",
      "Wait for the family to accept through their quote email.",
    ],
    PENDING_PAY:
      pendingReports > 0
        ? [
            "家屬已提交付款證明。請先核對銀行或 PayMe 實際入帳，再完成下方對數。",
            "Payment proof is ready. Check the actual bank or PayMe receipt, then reconcile below.",
          ]
        : [
            "等候家屬付款及上載截圖；收到後先核對實際入帳。",
            "Wait for the family to pay and upload a screenshot, then check the actual receipt.",
          ],
    PAID: [
      "收款已確認。核對派單預覽後，便可招募護士。",
      "Payment is verified. Review the dispatch preview, then recruit a nurse.",
    ],
    POSTED: [
      "正在招募護士，等候護士確認接單。",
      "Recruitment is open. Wait for a nurse to accept.",
    ],
    REMATCH: [
      "需要重新配對護士，可在人工覆核中再次招募。",
      "Another nurse is needed. Repost from manual review below.",
    ],
    MATCHED: [
      "護士已接單。請核實地址，完成護理時間表覆核及最終確認。",
      "A nurse has accepted. Confirm the address and complete the care schedule review and final approval.",
    ],
    READY: [
      "服務已安排，等候護士到達。",
      "The visit is ready. Wait for the nurse to arrive.",
    ],
    IN_SERVICE: [
      "服務進行中，等候護士確認完成。",
      "The visit is in progress. Wait for the nurse to confirm completion.",
    ],
    CANCELLED: [
      "此個案已取消，毋須再派單。收款及退款紀錄可在下方查閱。",
      "This case is cancelled. Review any payment and refund records below.",
    ],
    EXPIRED: [
      "報價已失效。如家屬仍需服務，請跟進並重新建立安排。",
      "The quote has expired. Follow up and create a new arrangement if care is still needed.",
    ],
    PAY_TIMEOUT: [
      "付款期限已過。如家屬表示已轉帳，請聯絡跟進並核對銀行紀錄。",
      "The payment deadline has passed. Follow up and check bank records if the family reports a transfer.",
    ],
    DONE: [
      "服務已完成，可查閱護理時間表及相關紀錄。",
      "The visit is complete. The care schedule and records remain available below.",
    ],
    NO_DR_ORDER: [
      "請先跟進所需醫生指示，再安排服務。",
      "Follow up on the required doctor order before arranging care.",
    ],
    NO_FIRST_INSERT: [
      "此服務不提供首次插喉，請跟進家屬的其他安排。",
      "First insertion is unavailable. Follow up with the family on alternative arrangements.",
    ],
  };
  const next =
    c.refund_status === "APPROVED"
      ? text(
          "退款已批核。請於銀行完成轉帳，再在下方記錄實際退款。",
          "The refund is approved. Complete the bank transfer, then record it below.",
        )
      : c.refund_status === "PENDING"
        ? text(
            "有退款／套餐時數待批核，請打開下方人工覆核處理。",
            "A refund or package release awaits approval. Open manual review below.",
          )
        : guidance[c.status]?.[zh ? 0 : 1];
  return (
    <>
      <div className="ev-case-header ev-state">
        <div>
          <span className="ev-case-caption">
            {text("個案編號", "Case number")}
          </span>
          <strong>{c.id}</strong>
        </div>
        <span
          className={`ev-case-badge ${closed ? "is-closed" : ""}`}
          title={c.status}
        >
          {caseStatusLabel(c.status, zh)}
        </span>
      </div>
      <dl className="ev-case-facts">
        <div>
          <dt>
            <CalendarDays size={16} />
            {text("服務時間 · 香港", "Visit · Hong Kong time")}
          </dt>
          <dd>
            {c.date || text("待確認", "To confirm")}
            <small>
              {c.start}–{c.end}
              {c.end < c.start ? text("（翌日）", " (+1 day)") : ""}
              {c.visits && c.visits.length > 1
                ? text(
                    ` · 共 ${c.visits.length} 次`,
                    ` · ${c.visits.length} visits`,
                  )
                : ""}
            </small>
          </dd>
        </div>
        <div>
          <dt>
            <MapPin size={16} />
            {text("服務地點", "Location")}
          </dt>
          <dd>
            {c.district || text("待確認", "To confirm")}
            <small>
              {c.building || text("大廈待確認", "Building to confirm")}
            </small>
          </dd>
        </div>
        <div>
          <dt>
            <UserRound size={16} />
            {text("病人及聯絡資料", "Patient and contact")}
          </dt>
          <dd>
            {c.surname || text("待確認", "To confirm")}
            {c.patient_ref && (
              <small>
                {text("病人代號：", "Patient reference: ")}
                {c.patient_ref}
              </small>
            )}
            <small>{c.email || "—"}</small>
            {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
          </dd>
        </div>
      </dl>
      <div className="ev-case-totals">
        <div>
          <span>{text("報價總額", "Quoted total")}</span>
          <strong>
            {c.quote
              ? `HK$${c.quote.total.toLocaleString("en-HK")}`
              : text("待報價", "Not quoted")}
          </strong>
        </div>
        <div>
          <span>{text("服務類型", "Order type")}</span>
          <strong>
            {c.order_type?.startsWith("PACKAGE")
              ? text("套餐服務", "Care package")
              : text("單次服務", "Single visit")}
          </strong>
          {c.package_id && <small>{c.package_id}</small>}
        </div>
        <div>
          <span>{text("護士交通津貼", "Nurse travel allowance")}</span>
          <strong>
            {c.remote_tier === "UNMATCHED" || c.remote_review_required
              ? text("待覆核", "Awaiting review")
              : `HK$${(c.nurse_travel_allowance ?? 0).toLocaleString("en-HK")}`}
          </strong>
          <small>{text("由平台支付", "Paid by the platform")}</small>
        </div>
        <div>
          <span>{text("退款", "Refund")}</span>
          <strong>{refundStatusLabel(c.refund_status, zh)}</strong>
          {c.refund_status && (
            <small>HK${(c.refund_amount ?? 0).toLocaleString("en-HK")}</small>
          )}
        </div>
      </div>
      {next && (
        <div className={`ev-next-action ${closed ? "is-closed" : ""}`}>
          <strong>
            {text(
              closed && !["PENDING", "APPROVED"].includes(c.refund_status || "")
                ? "個案狀況"
                : "目前下一步",
              closed && !["PENDING", "APPROVED"].includes(c.refund_status || "")
                ? "Case update"
                : "Next step",
            )}
          </strong>
          <p>{next}</p>
        </div>
      )}
    </>
  );
}
