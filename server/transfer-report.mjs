export class TransferReportError extends Error {
  constructor(errors) {
    super(Object.values(errors).join("；"));
    this.status = 400;
    this.errors = errors;
  }
}

const hktMinute = (at) => new Date(at + 8 * 3600000).toISOString().slice(0, 16);

export function validateTransferReport(input, c, now) {
  const reference = String(input.reference || "").trim();
  const amount = Number(input.amount);
  const splitTime = ["transfer_date", "transfer_hour", "transfer_minute"].some(
    (key) => key in input,
  );
  const time = splitTime
    ? `${input.transfer_date || ""}T${input.transfer_hour || ""}:${input.transfer_minute || ""}`
    : String(input.transferred_at || "");
  const at = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)
    ? Date.parse(`${time}+08:00`)
    : NaN;
  const errors = {};
  if (!reference || reference.length > 100)
    errors.reference = "請填寫銀行轉帳參考編號（1–100 字）。";
  if (!Number.isSafeInteger(amount) || amount <= 0)
    errors.amount = "轉帳金額請填正整數港元，不要加入 HK$ 或逗號。";
  if (!Number.isFinite(at) || hktMinute(at) !== time.slice(0, 16))
    errors.transferred_at =
      "請選擇完整有效的轉帳日期、時及分（香港時間，24 小時制）。";
  else if (at < Math.floor(Date.parse(c.created_at) / 60000) * 60000)
    errors.transferred_at = `轉帳時間不可早於個案建立時間：${hktMinute(Date.parse(c.created_at)).replace("T", " ")}（香港時間）。請填銀行紀錄中的實際轉帳時間。`;
  else if (at > now + 60000)
    errors.transferred_at =
      "轉帳時間不可在未來。請填銀行紀錄中的實際轉帳時間，並留意上午／下午（24 小時制）。";
  if (Object.keys(errors).length) throw new TransferReportError(errors);
  return { reference, amount, transferred_at: new Date(at).toISOString() };
}

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function transferReportForm(
  c,
  token,
  now,
  mode,
  values = {},
  errors = {},
) {
  const legacy = String(values.transferred_at || "");
  const date = values.transfer_date ?? legacy.slice(0, 10);
  const hour = values.transfer_hour ?? legacy.slice(11, 13);
  const minute = values.transfer_minute ?? legacy.slice(14, 16);
  const error = (key) =>
    errors[key]
      ? `<p id="${key}-error" role="alert" style="color:#a12734">${escape(errors[key])}</p>`
      : "";
  const invalid = (key) =>
    errors[key] ? ` aria-invalid="true" aria-describedby="${key}-error"` : "";
  const options = (length, selected) =>
    `<option value="">請選擇</option>${Array.from({ length }, (_, n) =>
      String(n).padStart(2, "0"),
    )
      .map(
        (value) =>
          `<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`,
      )
      .join("")}`;
  return `<p>Case ${escape(c.id)} · 應付 HK$${escape(c.payment_amount ?? c.quote.total)}</p>
    <p>本頁只登記已完成的轉帳資料，管理員須獨立核對銀行入帳，先可確認收款及派單。${mode === "bank_transfer" ? "如已轉帳，請勿重複轉帳。" : "測試請使用虛構資料，不要實際轉帳。"}</p>
    ${Object.keys(errors).length ? '<p role="alert">轉帳資料尚未提交，請更正以下欄位。已填資料仍然保留。</p>' : ""}
    <form method="POST" action="/a?t=${escape(token)}">
      <label for="reference">轉帳參考編號</label><br><input id="reference" name="reference" required maxlength="100" autocomplete="off" value="${escape(values.reference)}"${invalid("reference")}>${error("reference")}<br>
      <label for="amount">實際轉帳金額 HKD（整數）</label><br><input id="amount" name="amount" type="number" min="1" step="1" required value="${escape(values.amount ?? c.payment_amount ?? c.quote.total)}"${invalid("amount")}>${error("amount")}
      <fieldset style="min-width:0;border:1px solid #dcd5e2;border-radius:12px;margin:20px 0;padding:16px"><legend>實際轉帳時間（香港時間，24 小時制）</legend>
        <p style="font-size:15px">請按銀行紀錄選擇轉帳日期及時間，並非上門服務日期。例如下午 3 時 30 分請選 15 時 30 分。<br>個案建立時間：${escape(hktMinute(Date.parse(c.created_at)).replace("T", " "))}；目前香港時間：${escape(hktMinute(now).replace("T", " "))}。</p>
        <label for="transfer-date">轉帳日期</label><br><input id="transfer-date" name="transfer_date" type="date" required min="${escape(hktMinute(Date.parse(c.created_at)).slice(0, 10))}" max="${escape(hktMinute(now + 60000).slice(0, 10))}" value="${escape(date)}"${invalid("transferred_at")}><br>
        <div style="display:flex;gap:12px;flex-wrap:wrap"><label>時<select name="transfer_hour" required${invalid("transferred_at")}>${options(24, hour)}</select></label><label>分<select name="transfer_minute" required${invalid("transferred_at")}>${options(60, minute)}</select></label></div>${error("transferred_at")}
      </fieldset><button type="submit">確認：提交轉帳資料（待管理員對數）</button>
    </form>`;
}
