import { Mail } from "lucide-react";
import { useLocale } from "./i18n";
import { emailHtml } from "../server/email-template.mjs";
import type { EmailTemplateMessage } from "../server/email-template.mjs";

export function EmailPreview({ mail }: { mail: EmailTemplateMessage }) {
  const { language } = useLocale();
  const zh = language === "zh-HK";
  return (
    <div className="ev-email-preview">
      <div className="ev-email-preview-heading">
        <Mail size={16} aria-hidden="true" />
        <strong>{zh ? "電郵預覽" : "Email preview"}</strong>
        <span>CareKnock</span>
      </div>
      <iframe
        title={zh ? "CareKnock 電郵預覽" : "CareKnock email preview"}
        srcDoc={emailHtml(mail)}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
