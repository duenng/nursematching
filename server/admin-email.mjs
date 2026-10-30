export const validAdminEmail = (value) =>
  typeof value === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) &&
  !/@example\.(test|com|org|net)$/i.test(value.trim());

export function adminNotificationEmail(state, live) {
  const configured = String(state.admin_email || "")
    .trim()
    .toLowerCase();
  if (live) return validAdminEmail(configured) ? configured : "";
  return configured || "admin@example.test";
}
