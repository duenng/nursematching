export type EmailTemplateMessage = {
  subject: string;
  body: string;
  template_id?: string;
  case_id?: string;
  links?: { label: string; url: string }[];
};
export const ACTION_LABELS: Record<string, string>;
export function emailHtml(mail: EmailTemplateMessage): string;
