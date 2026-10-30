/**
 * API origin is empty for same-origin/local Vite proxy development and an
 * absolute backend origin for a separately hosted frontend.
 */
const buildEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
export const API_BASE_URL = String(buildEnv?.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");

export function apiUrl(path: string) {
  if (!path.startsWith("/")) throw new Error("API paths must start with /");
  return `${API_BASE_URL}${path}`;
}
