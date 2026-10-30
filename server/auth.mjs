import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookies = (req) =>
  Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s))
      .filter((part) => part.length >= 2),
  );
const emailList = (value) =>
  new Set(
    String(value || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
export const staffId = (email) =>
  "STAFF-" + hash(email.trim().toLowerCase()).slice(0, 20);

// Shared-key and local rehearsal identities never count as individually authenticated staff.
export function localIdentity(req, key) {
  if (key) {
    const given = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    return equal(given, key)
      ? { id: "SHARED-ADMIN-KEY", role: "ADMIN", method: "shared_key" }
      : null;
  }
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
    req.socket.remoteAddress,
  ) && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || "")
    ? { id: "LOCAL-REHEARSAL", role: "ADMIN", method: "loopback" }
    : null;
}

export function canAccess(user, path, method, input = {}) {
  if (!user) return false;
  if (path === "/api/workflow" && method === "GET") return true;
  if (method !== "POST") return false;
  if (user.method !== "google") return user.role === "ADMIN";
  const clinical = ["draft", "nurse", "schedule_edit", "doctor_failed"];
  if (user.role === "SENIOR_NURSE")
    return path === "/api/case-action" && clinical.includes(input.action);
  if (user.role === "ADMIN")
    return !(
      path === "/api/case-action" &&
      ["nurse", "schedule_edit", "doctor_failed"].includes(input.action)
    );
  return false;
}

export class StaffAuth {
  constructor(
    db,
    {
      env = process.env,
      baseUrl,
      now = Date.now,
      provider,
      audit = () => {},
      allowedOrigins = [],
      frontendUrl = "",
    } = {},
  ) {
    this.db = db;
    this.now = now; // Authentication always uses wall time, independent of experiment clocks.
    this.audit = audit;
    this.baseUrl = new URL(baseUrl).origin;
    this.frontendUrl = frontendUrl ? new URL(frontendUrl).origin : "";
    this.allowedOrigins = new Set(
      [this.baseUrl, this.frontendUrl, ...allowedOrigins]
        .filter(Boolean)
        .map((origin) => new URL(origin).origin),
    );
    this.mode =
      env.AUTH_MODE ||
      (env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET ? "google" : "local");
    if (!["google", "local"].includes(this.mode))
      throw new Error("AUTH_MODE must be google or local");
    if (
      this.mode === "local" &&
      (env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET)
    )
      throw new Error("Google credentials configured: use AUTH_MODE=google");
    this.key = env.WORKFLOW_ADMIN_KEY;
    this.clientId = env.GOOGLE_CLIENT_ID;
    this.admins = emailList(env.STAFF_ADMIN_EMAILS);
    this.seniors = emailList(env.STAFF_SENIOR_NURSE_EMAILS);
    this.secure = new URL(this.baseUrl).protocol === "https:";
    this.crossSiteCookie =
      this.frontendUrl && new URL(this.frontendUrl).origin !== this.baseUrl;
    this.sessionCookie = this.secure
      ? "__Host-kindred_session"
      : "kindred_session";
    this.stateCookie = this.secure ? "__Host-kindred_oauth" : "kindred_oauth";
    if (this.mode === "google") {
      if (
        !env.GOOGLE_CLIENT_ID ||
        !env.GOOGLE_CLIENT_SECRET ||
        !this.admins.size
      )
        throw new Error(
          "Google login requires client ID, client secret and STAFF_ADMIN_EMAILS",
        );
      if ([...this.admins].some((e) => this.seniors.has(e)))
        throw new Error(
          "Use different accounts for administrator and senior nurse roles",
        );
      const url = new URL(this.baseUrl);
      if (!this.secure && !["localhost", "127.0.0.1"].includes(url.hostname))
        throw new Error("Google login requires HTTPS outside localhost");
    }
    this.provider =
      provider ||
      new OAuth2Client({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: this.baseUrl + "/auth/google/callback",
        transporterOptions: { timeout: 10000, retry: false },
      });
    db.exec(`CREATE TABLE IF NOT EXISTS staff_sessions (
      token_hash TEXT PRIMARY KEY, staff_id TEXT NOT NULL, email TEXT NOT NULL,
      csrf TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_states (
      state_hash TEXT PRIMARY KEY, binding_hash TEXT NOT NULL, verifier TEXT NOT NULL,
      nonce TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS staff_identities (
      staff_id TEXT PRIMARY KEY, email TEXT NOT NULL, google_subject TEXT NOT NULL);`);
  }
  cookie(name, value, seconds, sameSiteOverride) {
    // OAuth state returns through a top-level GET from Google, so Lax is both
    // sufficient and more reliable than a third-party None cookie. The staff
    // session itself needs None when the Pages frontend calls this API.
    const sameSite =
      sameSiteOverride || (this.crossSiteCookie ? "None" : "Lax");
    return `${name}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${seconds}${this.secure || this.crossSiteCookie ? "; Secure" : ""}`;
  }
  role(email) {
    if (this.admins.has(email)) return "ADMIN";
    if (this.seniors.has(email)) return "SENIOR_NURSE";
    return null;
  }
  current(req) {
    if (this.mode !== "google") return localIdentity(req, this.key);
    const token = cookies(req)[this.sessionCookie];
    if (!token) return null;
    const row = this.db
      .prepare(
        "SELECT * FROM staff_sessions WHERE token_hash=? AND expires_at>?",
      )
      .get(hash(token), this.now());
    if (!row) return null;
    const role = this.role(row.email);
    if (!role) return null;
    return {
      id: row.staff_id,
      email: row.email,
      role,
      csrf: row.csrf,
      method: "google",
      expires_at: new Date(row.expires_at).toISOString(),
    };
  }
  verifyMutation(req, user) {
    if (req.headers.origin && !this.allowedOrigins.has(req.headers.origin))
      return false;
    if (user?.method !== "google") return true;
    return (
      this.allowedOrigins.has(req.headers.origin) &&
      equal(req.headers["x-csrf-token"], user.csrf)
    );
  }
  async begin() {
    if (this.mode !== "google")
      throw new Error("Google login is not configured");
    this.db
      .prepare("DELETE FROM oauth_states WHERE expires_at<=?")
      .run(this.now());
    this.db
      .prepare("DELETE FROM staff_sessions WHERE expires_at<=?")
      .run(this.now());
    if (
      this.db.prepare("SELECT count(*) AS count FROM oauth_states").get()
        .count >= 200
    )
      throw new Error("Too many pending logins; try again later");
    const state = random(),
      binding = random(),
      nonce = random();
    const { codeVerifier, codeChallenge } =
      await this.provider.generateCodeVerifierAsync();
    this.db
      .prepare("INSERT INTO oauth_states VALUES (?,?,?,?,?)")
      .run(
        hash(state),
        hash(binding),
        codeVerifier,
        nonce,
        this.now() + 600000,
      );
    return {
      cookie: this.cookie(this.stateCookie, binding, 600, "Lax"),
      location: this.provider.generateAuthUrl({
        scope: ["openid", "email", "profile"],
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      }),
    };
  }
  async finish(req, url) {
    const state = url.searchParams.get("state") || "";
    const binding = cookies(req)[this.stateCookie] || "";
    const row = this.db
      .prepare("SELECT * FROM oauth_states WHERE state_hash=?")
      .get(hash(state));
    if (
      !row ||
      row.expires_at <= this.now() ||
      !equal(hash(binding), row.binding_hash)
    )
      throw new Error("Login expired or browser state invalid; start again");
    // Consume before any external request; replay and concurrent callbacks cannot create another session.
    this.db
      .prepare("DELETE FROM oauth_states WHERE state_hash=?")
      .run(hash(state));
    const code = url.searchParams.get("code");
    if (url.searchParams.has("error") || !code)
      throw new Error("Google login was cancelled");
    const { tokens } = await this.provider.getToken({
      code,
      codeVerifier: row.verifier,
    });
    if (!tokens.id_token) throw new Error("Google identity token missing");
    const ticket = await this.provider.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    const email = String(payload?.email || "").toLowerCase();
    if (
      payload?.email_verified !== true ||
      !payload.sub ||
      !equal(payload.nonce, row.nonce) ||
      !["https://accounts.google.com", "accounts.google.com"].includes(
        payload.iss,
      ) ||
      !(payload.exp * 1000 > this.now())
    )
      throw new Error("Google identity verification failed");
    const role = this.role(email);
    if (!role) {
      this.audit("auth.denied", { actor_code: staffId(email) });
      throw new Error("This account is not on the staff allowlist");
    }
    const id = staffId(email);
    const existing = this.db
      .prepare("SELECT google_subject FROM staff_identities WHERE staff_id=?")
      .get(id);
    if (existing && existing.google_subject !== payload.sub)
      throw new Error("Staff account identity changed; contact administrator");
    this.db
      .prepare("INSERT OR IGNORE INTO staff_identities VALUES (?,?,?)")
      .run(id, email, payload.sub);
    const token = random(),
      csrf = random();
    this.db
      .prepare("INSERT INTO staff_sessions VALUES (?,?,?,?,?,?)")
      .run(hash(token), id, email, csrf, this.now(), this.now() + 8 * 3600000);
    this.audit("auth.login", {
      actor: role === "ADMIN" ? "admin" : "senior_nurse",
      actor_code: id,
    });
    return {
      // Keep the workspace on the cookie's origin. Safari blocks the session
      // as a third-party cookie when the public site uses a different domain.
      location: "/#staff/email",
      cookies: [
        this.cookie(this.sessionCookie, token, 8 * 3600),
        this.cookie(this.stateCookie, "", 0, "Lax"),
      ],
    };
  }
  logout(req) {
    const user = this.current(req);
    const token = cookies(req)[this.sessionCookie];
    if (token)
      this.db
        .prepare("DELETE FROM staff_sessions WHERE token_hash=?")
        .run(hash(token));
    if (user) this.audit("auth.logout", { actor_code: user.id });
    return this.cookie(this.sessionCookie, "", 0);
  }
}

// Clinical reviewers receive the clinical worklist, never family/nurse action links or payment data.
export function clinicalWorkspace(state) {
  const fields = [
    "id",
    "status",
    "date",
    "shift",
    "start",
    "end",
    "patient_ref",
    "gender",
    "age",
    "weight_kg",
    "height_cm",
    "mobility",
    "companion",
    "recent_3m",
    "medical_history",
    "remarks",
    "intake_channel",
    "enquiry_summary",
    "care_needs",
    "preferred_timing",
    "patient_age_description",
    "other_need_text",
    "services",
    "doctor_order",
    "doctor_order_file",
    "doctor_order_status",
    "doctor_document",
    "doctor_order_review",
    "schedule",
    "schedule_status",
    "schedule_version",
    "schedule_edits",
    "reviewed_by",
    "confirmed_by",
  ];
  return {
    cases: state.cases.map((c) =>
      Object.fromEntries(fields.filter((k) => k in c).map((k) => [k, c[k]])),
    ),
  };
}
