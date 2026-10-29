export const TEMPLATE_VERSION = "v3-email-trl3-1";
export const ACTION_LABELS = {
  upload_doctor: "上載醫生指示文件",
  report_fps: "提交轉帳資料",
  accept_single: "接受單次報價",
  accept_package: "30 小時套餐",
  accept_existing_package: "使用現有套餐",
  modify: "我想修改",
  decline: "取消預約",
  cancel: "取消預約",
  take_case: "我要做此個案",
  provide_unit: "填寫單位",
  confirm_reminder: "確認已收到提醒",
  arrived: "已到達",
  visit_done: "完成",
  drop: "我唔可以做",
};
export const TEMPLATE_CATALOG = {
  T1: { scope: "SLICE", description: "單次報價及可選套餐" },
  T1b: { scope: "EXTRA", description: "現有套餐報價" },
  T2: { scope: "EXTRA", description: "報價提醒" },
  T3: { scope: "SLICE", description: "個別護士派單" },
  T4: { scope: "OPTIONAL", description: "收到報名；即時確認頁取代" },
  T4b: { scope: "SLICE", description: "未合資格" },
  T4c: { scope: "SLICE", description: "得標通知" },
  T5: { scope: "OPTIONAL", description: "其他護士已有人接" },
  T6: { scope: "PAGE", description: "落標頁面字眼" },
  T7: { scope: "SLICE", description: "搵緊護士" },
  T8: { scope: "SLICE", description: "付款連結" },
  T8b: { scope: "EXTRA", description: "套餐付款連結" },
  T9: { scope: "SLICE", description: "單次收據" },
  T9b: { scope: "EXTRA", description: "套餐收據" },
  T10: { scope: "SLICE", description: "付款提醒" },
  T10b: { scope: "SLICE", description: "付款逾時" },
  T11: { scope: "SLICE", description: "得標護士完整資料及時間表" },
  T12: { scope: "SLICE", description: "項目提醒" },
  T13: { scope: "SLICE", description: "未確認追問" },
  T14: { scope: "EXTRA", description: "管理員警示" },
  T14b: { scope: "SLICE", description: "無護士" },
  T14c: { scope: "EXTRA", description: "缺單位" },
  T14e: { scope: "EXTRA", description: "護士放飛" },
  T14f: { scope: "EXTRA", description: "第三次放飛待批核" },
  T14g: { scope: "EXTRA", description: "偏遠交通津貼覆核" },
  T14m: { scope: "SLICE", description: "交人手" },
  T14d: { scope: "OUT", description: "遲到規則未定，不啟用" },
  T15: { scope: "EXTRA", description: "免費取消" },
  T16: { scope: "SLICE", description: "私下收集單位" },
  T17: { scope: "SLICE", description: "客人配對通知" },
  T18: { scope: "SLICE", description: "缺醫生指示" },
  T19: { scope: "EXTRA", description: "重新配對" },
  T20: { scope: "EXTRA", description: "重新配對失敗退款" },
  T21: { scope: "EXTRA", description: "重新招募" },
  T22: { scope: "EXTRA", description: "放飛次數" },
  T23: { scope: "EXTRA", description: "暫停／黑名單" },
  T24: { scope: "EXTRA", description: "通知護士客人取消" },
  T25: { scope: "DEFERRED", description: "公司註冊後：入職申請" },
  T25b: { scope: "DEFERRED", description: "公司註冊後：入職拒絕" },
  T26: { scope: "DEFERRED", description: "公司註冊後：入職批准" },
  T27: { scope: "SLICE", description: "不提供首次插喉" },
  T28: { scope: "EXTRA", description: "套餐扣時" },
  T29: { scope: "EXTRA", description: "套餐低餘額" },
  T30: { scope: "EXTRA", description: "套餐用完" },
  X01: { scope: "EXTRA", description: "收到查詢" },
  X02: { scope: "EXTRA", description: "報價失效" },
  X03: { scope: "SLICE", description: "同事核實" },
  X04: { scope: "SLICE", description: "修改請求" },
  X05: { scope: "SLICE", description: "付款前取消" },
};
export function canonical(id, c, body) {
  const fixed = {
    T4: "收到你報名 Case " + c.id + "，系統確認後會即時通知你。",
    T4b: "你好，你暫時未可以報名接單。如有疑問請聯絡管理員。",
    T4c: `恭喜，Case ${c.id} 由你負責。地址及 Care Schedule 確認後會以另一封電郵發俾你。如之後唔可以做，請即時通知我哋。`,
    T5: `Case ${c.id} 已俾人做，多謝各位。`,
    T6: `Case ${c.id} 已有護士接咗，多謝你報名。`,
    T7: `你好，Case ${c.id} 搵緊護士接單中，請耐心等候。有消息我哋會即時通知你。`,
    T16: `你好，Case ${c.id} 已配對護士。為咗護士準時上門，請撳以下掣填寫服務地址嘅樓層及單位（例如：12 樓 B 室；如大廈有多座或村屋，請一併寫座數／門牌）。資料只會交俾負責護士。`,
    T17: `你好，Case ${c.id} 已搵到護士負責 ${c.date} 嘅服務。`,
    T18: `你好，多謝你查詢（Case ${c.id}）。你揀選嘅「${c.services
      .filter((s) => s.category === "B")
      .map((s) => s.label)
      .join(
        "、",
      )}」需要醫生指示或處方先可以安排。由於你表示暫時未有，今次查詢未能處理。\n如之後取得醫生指示，或者只需要其他服務，歡迎重新填寫查詢表格。`,
    T24: `Case ${c.id} ${c.date} 嘅服務客人已取消，今次唔使上門。多謝你。`,
    T27: `你好，多謝你查詢（Case ${c.id}）。我哋只提供更換現有${c.services
      .filter((s) => s.replace_only)
      .map((s) => s.label)
      .join(
        "、",
      )}，唔提供首次插入。由於你表示病人而家未有呢條喉，今次查詢未能處理。\n建議你先向醫院或診所安排首次插喉；之後如需要上門更換，歡迎重新填寫查詢表格。`,
    X01: `你好，我哋已收到你嘅上門護理查詢（Case ${c.id}），會盡快以電郵發報價俾你。`,
    X02: `你好，Case ${c.id} 嘅報價已失效。如仍需要服務，歡迎重新查詢。`,
    X03: `你好，多謝你查詢（Case ${c.id}）。我哋同事需要再核實少少資料，會盡快聯絡你。`,
    X04: `你好，收到你想修改 Case ${c.id} 嘅報價，我哋同事會盡快跟進。`,
    X05: `你好，Case ${c.id} 嘅預約已取消，今次唔收任何費用。如仍需要服務，歡迎重新查詢。`,
  };
  return fixed[id] ?? body;
}
export function emailHtml(mail) {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  return `<html lang="zh-HK"><body style="font:18px/1.8 system-ui;color:#302044"><h1 style="font-size:24px">${esc(mail.subject)}</h1><p style="white-space:pre-wrap">${esc(mail.body)}</p>${mail.links.map((l) => `<p><a style="display:inline-block;background:#694084;color:white;padding:12px 20px;border-radius:8px;text-decoration:none" href="${esc(l.url)}">${esc(ACTION_LABELS[l.label] || l.label)}</a></p>`).join("")}<small>請開啟確認頁後，再按確認掣。直接開啟電郵連結不會更改個案。</small></body></html>`;
}
