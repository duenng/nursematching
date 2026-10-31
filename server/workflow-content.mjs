// Shared by actual email delivery and read-only previews. No recipient or unit fields.
export function dispatchBody(c, settings = {}) {
  const rate =
    c.shift === "DAY" ? settings.nurse_day_rate : settings.nurse_night_rate;
  const allowance = c.nurse_travel_allowance || 0;
  const pay =
    Number.isFinite(rate) && Number.isFinite(c.quote?.hours)
      ? `HK$${rate}／小時，共 HK$${rate * c.quote.hours}${allowance ? `；另加交通津貼 HK$${allowance}，合共 HK$${rate * c.quote.hours + allowance}` : ""}`
      : `待管理員確認${allowance ? `；另加交通津貼 HK$${allowance}` : ""}`;
  return `📋 Case ${c.id}\n日期時間：${c.date} ${c.start}–${c.end}（${c.shift === "DAY" ? "日間" : "夜間"}）\n薪酬：${pay}\n地區／大廈：${c.district} ${c.building}\n照顧重點：${(c.services || []).map((s) => `${s.label} ${s.prn ? "（按需要）" : (s.times || []).join("、")}${s.replace_only ? "（更換現有喉管，唔使首次插入）" : ""}`).join("；")}\n先到先得，有興趣請撳以下掣：`;
}
export function quoteBody(c, settings) {
  return `你好，${c.surname}先生／女士。多謝你查詢上門護理服務（Case ${c.id}）。\n服務：${c.date} ${c.start}–${c.shift === "DAY" ? "" : "翌日 "}${c.end}\n服務內容：${(c.services || []).map((s) => s.label).join("、")}\n收費明細：基本費 HK$${c.quote.base}｜公眾假期及星期日附加費 HK$${c.quote.surcharge}\n總額：HK$${c.quote.total}${c.quote.pricing_method === "MANUAL_NIGHT_HOLIDAY" ? "\n以上為經人工覆核的夜更報價。" : ""}\n備註：所需工具及物料需由你自備。\n付款：確認後會收到付款連結，請喺 ${settings.payment_window_hours} 小時內付清，否則預約會自動取消。\n取消／改期：服務開始前 24 小時或以上通知免費；少於 24 小時：由同事跟進。`;
}
export function confirmationDetails(c, action, settings, now) {
  if (action === "take_case") return dispatchBody(c, settings);
  if (action === "provide_unit")
    return `服務地址：${c.district} ${c.building}\n資料只會交俾負責護士。`;
  if (action === "accept_single") return quoteBody(c, settings);
  if (action === "accept_package")
    return `${quoteBody(c, settings)}\n你選擇：${settings.package_hours} 小時套餐 HK$${settings.package_price}；本次預留 ${c.quote.hours} 小時，完成後扣時。`;
  if (action === "accept_existing_package")
    return `服務：${c.date} ${c.start}–${c.end}\n本次將從套餐 ${c.available_package_id} 預留 ${c.quote.hours} 小時；完成服務後先扣。規則未確認或餘額不足會交人手。`;
  if (["cancel", "decline"].includes(action)) {
    if (["QUOTED", "PENDING_PAY"].includes(c.status))
      return "確認後取消本次預約，不收任何費用；付款及報價連結將失效。";
    if (
      ["MATCHED", "READY"].includes(c.status) &&
      Date.parse(`${c.date}T${c.start}:00+08:00`) - now >=
        settings.cancellation_free_hours * 3600000
    )
      return "距服務開始至少 24 小時，取消免費。退款／套餐預留時數須由管理員批核；退款另須人手處理，不代表款項已退回。";
    return "本次取消須由同事跟進。少於 24 小時取消費、未配對或服務開始後的安排未定；提交要求不代表已完成取消或退款。";
  }
  if (action === "visit_done")
    return "確認本次服務已完成。套餐將扣除本次預留時數，並產生護士待付紀錄。";
  return "";
}
