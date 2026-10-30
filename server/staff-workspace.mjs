import { dispatchBody } from "./workflow-content.mjs";
import { randomUUID } from "node:crypto";
import { adminNotificationEmail } from "./admin-email.mjs";

const emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const realNurse = (n) =>
  !n.demo && !/@example\.(test|com|org|net)$/i.test(n.email || "");
export const eligibleNurse = (n, live) =>
  n.status === "VERIFIED" &&
  (!live || (realNurse(n) && !!n.registration && !!n.verified_by));
export function staffSnapshot(state, live) {
  const { tokens, ...snapshot } = state;
  const project = (c) => ({
    ...c,
    dispatch_preview_body: dispatchBody(c, state.settings),
  });
  if (!live) return { ...snapshot, cases: state.cases.map(project) };
  const cases = state.cases
    .filter((c) => c.intake_mode === "LIVE")
    .map(project);
  const ids = new Set(cases.map((c) => c.id));
  return {
    ...snapshot,
    admin_email: adminNotificationEmail(state, true),
    evidence: [],
    cases,
    nurses: state.nurses.filter(realNurse),
    emails: state.emails.filter((m) => ids.has(m.case_id)),
    events: state.events.filter((e) => !e.case_id || ids.has(e.case_id)),
    timers: state.timers.filter((t) => ids.has(t.case_id)),
    clients: state.clients.filter((c) =>
      cases.some((item) => item.client_id === c.id),
    ),
    packages: state.packages.filter((p) =>
      cases.some((c) => c.package_id === p.id),
    ),
    ledger_entries: state.ledger_entries.filter((e) => ids.has(e.case_id)),
    payouts: state.payouts.filter((p) => ids.has(p.case_id)),
    payment_submissions: state.payment_submissions.filter((p) =>
      ids.has(p.case_id),
    ),
    payment_reconciliations: state.payment_reconciliations.filter((p) =>
      ids.has(p.case_id),
    ),
  };
}
export function saveNurse(workflow, input) {
  return workflow.transaction(() => {
    const existing =
      input.id && workflow.state.nurses.find((n) => n.id === input.id);
    if (input.id && !existing) throw new Error("找不到護理員");
    const name = String(input.name || "").trim();
    const email = String(input.email || "")
      .trim()
      .toLowerCase();
    const registration = String(input.registration || "").trim();
    const verificationNote = String(input.verification_note || "").trim();
    if (
      !name ||
      name.length > 100 ||
      !emailValid(email) ||
      email.length > 254 ||
      !["RN", "EN"].includes(input.category)
    )
      throw new Error("請填妥姓名、有效電郵及 RN／EN 類別");
    if (!realNurse({ email }) && workflow.live)
      throw new Error("正式工作區不可使用示範電郵");
    if (
      workflow.state.nurses.some(
        (n) => n.id !== existing?.id && n.email.toLowerCase() === email,
      )
    )
      throw new Error("此電郵已有護理員紀錄");
    if (!["APPLIED", "VERIFIED", "SUSPENDED"].includes(input.status))
      throw new Error("護理員狀態無效");
    if (existing?.status === "BLACKLISTED")
      throw new Error("已取消資格的護理員不可透過編輯重新啟用");
    if (registration.length > 100 || verificationNote.length > 4000)
      throw new Error("核實資料長度超出限制");
    if (
      input.status === "VERIFIED" &&
      (!registration ||
        !verificationNote ||
        input.credentials_verified !== true)
    )
      throw new Error("啟用接單前須填註冊編號、核實紀錄並確認已查核資格");
    const active = workflow.state.cases.some(
      (c) =>
        c.assigned_nurse === existing?.id &&
        ["MATCHED", "READY", "IN_SERVICE", "REMATCH"].includes(c.status),
    );
    if (
      existing &&
      active &&
      (email !== existing.email ||
        input.status !== existing.status ||
        input.category !== existing.category)
    )
      throw new Error("護理員有進行中服務，請先處理個案再更改電郵、資格或狀態");
    if (
      existing &&
      (email !== existing.email || input.status !== existing.status)
    ) {
      for (const token of workflow.state.tokens)
        if (
          token.actor === existing.id &&
          !token.used_at &&
          !token.void_at &&
          token.action === "take_case"
        )
          token.void_at = workflow.stamp();
    }
    const n = existing || { id: `N-${randomUUID()}`, drop_count: 0 };
    Object.assign(n, {
      name,
      email,
      category: input.category,
      registration,
      verification_note: verificationNote,
      status: input.status,
      updated_at: workflow.stamp(),
    });
    if (input.status === "VERIFIED")
      Object.assign(n, {
        verified_at: workflow.stamp(),
        verified_by: workflow.operatorId("admin"),
      });
    if (!existing) workflow.state.nurses.push(n);
    workflow.event(existing ? "nurse.updated" : "nurse.created", null, {
      nurse: n.id,
      reason: verificationNote,
    });
    return n;
  });
}
