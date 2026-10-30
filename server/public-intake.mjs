// Public intake accepts only family-supplied fields; pricing, eligibility and location approval remain server-owned.
const fields = [
  "surname",
  "email",
  "phone",
  "district",
  "building",
  "date",
  "shift",
  "start",
  "end",
  "consent",
  "gender",
  "age",
  "weight_kg",
  "height_cm",
  "mobility",
  "companion",
  "patient_ref",
  "medical_history",
  "recent_3m",
  "existing_tubes",
  "doctor_order",
  "existing_tube",
  "remarks",
  "other",
  "services",
  "visits",
];
export const publicIntake = (input) => ({
  ...Object.fromEntries(
    fields.filter((k) => k in input).map((k) => [k, input[k]]),
  ),
  intake_version: "v3",
  intake_mode: "LIVE",
});
export function createIntakeLimiter(now = Date.now) {
  const attempts = new Map();
  return (address) => {
    for (const [key, value] of attempts)
      if (value.until <= now()) attempts.delete(key);
    const record = attempts.get(address) || {
      until: now() + 10 * 60000,
      count: 0,
    };
    if (
      record.count >= 30 ||
      (!attempts.has(address) && attempts.size >= 10000)
    )
      return false;
    record.count++;
    attempts.set(address, record);
    return true;
  };
}
