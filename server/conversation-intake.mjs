import { randomUUID } from "node:crypto";
import {
  enquiryMessages,
  assistantDraft,
  AssistantError,
} from "./intake-assistant.mjs";
import { SERVICE_CATALOG, hasRedFlag } from "./extended-workflow.mjs";

// This is an enquiry for staff follow-up, never a priced or scheduled booking.
export function createConversationEnquiry(workflow, input) {
  const messages = enquiryMessages(input.messages);
  const surname = typeof input.surname === "string" ? input.surname.trim() : "";
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (
    !surname ||
    surname.length > 80 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (phone && !/^\d{8}$/.test(phone)) ||
    input.consent !== true ||
    input.reviewed !== true
  )
    throw new AssistantError(
      400,
      "請核對內容、填妥姓名及有效電郵，並同意保存查詢。 / Review your enquiry, provide your name and valid email, and consent to storage.",
    );
  const draft = input.draft == null ? null : assistantDraft(input.draft);
  return workflow.transaction(() => {
    const remarks = messages
      .map((m, i) => `${i + 1}. ${m.content}`)
      .join("\n\n");
    const c = {
      id: `E${randomUUID()}`,
      ...workflow.intakeFields({
        intake_version: "v3",
        intake_mode: "LIVE",
        consent: true,
        surname,
      }),
      surname,
      email,
      phone,
      intake_channel: "conversation",
      patient_ref: "",
      date: "",
      shift: "",
      start: "",
      end: "",
      building: "",
      district: draft?.district || "",
      preferred_timing: draft?.preferred_timing || "",
      patient_age_description: draft?.age || "",
      mobility: draft?.mobility || "",
      services: (draft?.service_ids || []).map((id) => ({
        ...SERVICE_CATALOG.find((s) => s.id === id),
        times: [],
        prn: false,
      })),
      remarks,
      enquiry_summary: draft?.summary || "",
      care_needs: draft?.care_needs || "",
      ai_assisted: !!draft,
      ai_consent: input.ai_consent === true,
      status: "SUBMITTED",
      created_at: workflow.stamp(),
      quote_version: 1,
      address_status: "NOT_ASKED",
      schedule_status: "PENDING_REVIEW",
      visits: [],
    };
    c.red_flag = hasRedFlag({ remarks: `${remarks}\n${c.enquiry_summary}` });
    workflow.state.cases.push(c);
    workflow.event("case.submitted", c);
    workflow.manual(c, "文字查詢：病人資料、護理項目及服務時間待同事核實");
    let client = workflow.state.clients.find((item) => item.email === email);
    if (!client) {
      client = {
        id: `CLIENT-${workflow.state.clients.length + 1}`,
        email,
        created_at: workflow.stamp(),
      };
      workflow.state.clients.push(client);
    }
    c.client_id = client.id;
    workflow.email(c, "X01", email, "已收到查詢", "");
    return c;
  });
}
