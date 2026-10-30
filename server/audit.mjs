export const TIMER_CODES = {
  QUOTE_REMIND: "T-A",
  QUOTE_EXPIRE: "T-A",
  PAY_REMIND: "T-E1",
  PAY_EXPIRE: "T-E",
  NO_TAKER: "T-C",
  NO_TAKER_REPEAT: "T-C2",
  PRE_SERVICE: "T-S",
  NO_NURSE_START: "T-K",
  UNIT_CHASE: "T-J1",
  UNIT_ALERT: "T-J2",
  REMATCH_EXPIRE: "T-R",
};
export const EVENT_ALIASES = {
  "case.transitioned": "status.changed",
  "dispatch.posted": "case.posted",
  "dispatch.reposted": "case.posted",
  "payment.received": "payment.succeeded",
  "schedule.nurse_reviewed": "schedule.reviewed",
  "visit.completed": "visit.done",
  "refund.completed": "refund.done",
  "package.reserve": "package.reserved",
  "package.release": "package.released",
  "package.deduct": "package.deducted",
};
// Audit data uses codes. Never export bearer credentials or patient contact/address values.
export function auditDetail(detail, c) {
  const privateValues = [c?.email, c?.phone, c?.unit, c?.surname].filter(
    Boolean,
  );
  function clean(value, key = "") {
    if (
      /^(token|email|phone|unit|surname|bank_reference|reference)$/i.test(key)
    )
      return "[REDACTED]";
    if (typeof value === "string") {
      let result = value
        .replace(/https?:\/\/\S*[?&]t=\S+/g, "[ACTION LINK]")
        .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, "[EMAIL]")
        .replace(/\b\d{8}\b/g, "[PHONE]");
      for (const secret of privateValues)
        result = result.replaceAll(secret, "[PRIVATE]");
      return result;
    }
    if (Array.isArray(value)) return value.map((v) => clean(v));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, clean(v, k)]),
      );
    return value;
  }
  return clean(detail);
}
