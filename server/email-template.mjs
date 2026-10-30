// Keep this renderer browser-safe: the inbox previews the same HTML sent by SMTP.
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

// These colors follow src/homepage.css and src/theme.css. Inline styles and
// presentation tables keep the essential design intact in email clients.
const colors = {
  brand: "#750f6d",
  dark: "#4e154f",
  peach: "#f4c8b6",
  cream: "#faf8f6",
  text: "#473c4c",
  muted: "#6f6177",
  line: "#e4d9ea",
};
const font =
  "'Manrope', 'PingFang HK', 'Microsoft JhengHei', Arial, sans-serif";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const lineHtml = (value) => escape(value).replace(/\n/g, "<br>");
const table = (body, style = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${style}">${body}</table>`;

function category(id) {
  if (["T1", "T1b", "T2"].includes(id))
    return ["YOUR CARE PLAN", "護理服務報價"];
  if (["T8", "T8b", "T10", "T10b"].includes(id))
    return ["PAYMENT DETAILS", "付款及轉帳安排"];
  if (["T9", "T9b"].includes(id)) return ["PAYMENT RECEIVED", "收款確認"];
  if (["T3", "T4", "T4b", "T4c", "T5", "T6", "T21"].includes(id))
    return ["CARE TEAM", "護理團隊通知"];
  if (["T11", "T12", "T13"].includes(id))
    return ["YOUR CARE VISIT", "服務安排及提醒"];
  if (["T28", "T29", "T30"].includes(id))
    return ["YOUR CARE PACKAGE", "護理套餐更新"];
  return ["A NOTE FROM CAREKNOCK", "護理服務通知"];
}

function bodyHtml(body) {
  return String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const blocks = [];
      let details = [];
      let prose = [];
      const flushDetails = () => {
        if (!details.length) return;
        blocks.push(
          table(
            details
              .map(
                ([label, value]) =>
                  `<tr><td class="detail-label" valign="top" width="104" style="width:104px;padding:12px 14px;color:${colors.muted};font-size:14px;line-height:1.8;border-bottom:1px solid ${colors.line};">${escape(label)}</td><td valign="top" style="padding:12px 14px;font-size:16px;line-height:1.8;color:${colors.dark};border-bottom:1px solid ${colors.line};overflow-wrap:anywhere;word-break:break-word;">${escape(value)}</td></tr>`,
              )
              .join(""),
            `background:${colors.cream};border:1px solid ${colors.line};margin:8px 0 24px;`,
          ),
        );
        details = [];
      };
      const flushProse = () => {
        if (!prose.length) return;
        blocks.push(
          `<p style="margin:0 0 20px;font-size:16px;line-height:1.95;color:${colors.text};overflow-wrap:anywhere;word-break:break-word;">${lineHtml(prose.join("\n"))}</p>`,
        );
        prose = [];
      };
      for (const line of paragraph.split("\n")) {
        const detail = line.match(
          /^([\p{L}][\p{L}\p{N} ／（）()·_-]{0,17})[：:]\s*(.+)$/u,
        );
        if (detail) {
          flushProse();
          details.push([detail[1], detail[2]]);
        } else {
          flushDetails();
          prose.push(line);
        }
      }
      flushDetails();
      flushProse();
      return blocks.join("");
    })
    .join("");
}

function actionsHtml(links) {
  const secondary = new Set(["modify", "decline", "cancel", "drop"]);
  return links
    .map((link) => {
      // Only web URLs can be email actions; always escape the attribute as well.
      if (!/^https?:\/\//i.test(String(link.url))) return "";
      const quiet = secondary.has(link.label);
      return table(
        `<tr><td align="center" bgcolor="${quiet ? "#ffffff" : colors.brand}" style="border:1px solid ${quiet ? colors.line : colors.brand};border-radius:6px;mso-padding-alt:15px 22px;"><a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer" style="display:block;padding:15px 22px;border-radius:6px;font-family:${font};font-size:16px;line-height:1.5;font-weight:700;text-decoration:none;text-align:center;color:${quiet ? colors.brand : "#ffffff"};">${escape(ACTION_LABELS[link.label] || link.label)}</a></td></tr>`,
        "border-collapse:separate;border-spacing:0;margin-bottom:12px;",
      );
    })
    .join("");
}

export function emailHtml(mail) {
  const links = mail.links ?? [];
  const [eyebrow, description] = category(mail.template_id);
  const preheader = String(mail.body ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `<!doctype html>
<html lang="zh-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(mail.subject)} · CareKnock</title>
<style>
body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
@media only screen and (max-width:600px) {
  .email-shell { padding:16px 8px !important; }
  .email-pad { padding-left:24px !important; padding-right:24px !important; }
  .email-title { font-size:27px !important; }
  .detail-label { width:76px !important; padding-left:12px !important; padding-right:8px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${colors.cream};font-family:${font};color:${colors.text};">
<div style="display:none;font-size:1px;color:${colors.cream};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(preheader)}</div>
${table(
  `<tr><td class="email-shell" align="center" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;border-spacing:0;background:#ffffff;border:1px solid ${colors.line};border-radius:12px;overflow:hidden;">
<tr><td height="6" bgcolor="${colors.peach}" style="height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td class="email-pad" bgcolor="${colors.dark}" style="padding:28px 40px 26px;background-color:${colors.dark};">
${table(`<tr><td style="font-family:${font};font-size:28px;line-height:1.3;font-weight:700;letter-spacing:-1px;color:#ffffff;"><span aria-hidden="true" style="color:${colors.peach};font-size:32px;vertical-align:middle;">&#9829;</span>&nbsp; CareKnock<span style="color:${colors.peach};">.</span></td></tr><tr><td style="padding-top:9px;font-size:11px;line-height:1.7;letter-spacing:1.8px;color:#f4c8b6;">COMPASSIONATE CARE. CLOSER TO HOME.</td></tr>`)}
</td></tr>
<tr><td class="email-pad" style="padding:34px 40px 28px;border-bottom:1px solid ${colors.line};background-color:#fffdfb;">
<p style="margin:0 0 12px;font-size:11px;line-height:1.7;letter-spacing:1.8px;font-weight:700;color:${colors.brand};">${eyebrow}</p>
<h1 class="email-title" style="margin:0 0 18px;font-family:${font};font-size:32px;line-height:1.45;font-weight:700;letter-spacing:-0.7px;overflow-wrap:anywhere;word-break:break-word;color:${colors.dark};">${escape(mail.subject)}</h1>
<p style="margin:0;font-size:13px;line-height:1.8;color:${colors.muted};">${description}${mail.case_id ? ` &nbsp;·&nbsp; <span style="font-weight:700;color:${colors.brand};">CASE ${escape(mail.case_id)}</span>` : ""}</p>
</td></tr>
<tr><td class="email-pad" style="padding:32px 40px 14px;">${bodyHtml(mail.body)}</td></tr>
${links.length ? `<tr><td class="email-pad" style="padding:0 40px 26px;">${actionsHtml(links)}<p style="margin:18px 0 0;font-size:12px;line-height:1.9;color:${colors.muted};">請開啟確認頁後，再按確認掣。直接開啟電郵連結不會更改個案。</p></td></tr>` : ""}
<tr><td class="email-pad" bgcolor="#f1e7f5" style="padding:24px 40px;background-color:#f1e7f5;">
<p style="margin:0 0 6px;font-size:16px;font-weight:700;line-height:1.7;color:${colors.dark};">用心照顧，讓家更安心。</p>
<p style="margin:0;font-size:13px;line-height:1.9;color:${colors.muted};">如需協助，請回覆此電郵，讓我們一起安排下一步。</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="margin:22px 0 6px;font-family:${font};font-size:12px;line-height:1.8;font-weight:700;letter-spacing:0.5px;color:${colors.dark};">CareKnock · 香港</p>
<p style="margin:0;font-family:${font};font-size:11px;line-height:1.8;color:${colors.muted};">HOME NURSING &amp; CARE NAVIGATION</p>
</td></tr>`,
  `background-color:${colors.cream};`,
)}
</body>
</html>`;
}
