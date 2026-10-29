import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { LanguageSwitcher, useLocale } from "./i18n";
import { Logo } from "./components";
import "./pages/email-validation.css";

export type StaffSession = {
  id: string;
  email?: string;
  role: "ADMIN" | "SENIOR_NURSE";
  method: "google" | "shared_key" | "loopback";
  csrf?: string;
  expires_at?: string;
};
type SessionInfo = {
  mode: "google" | "local";
  user: StaffSession | null;
  login_url: string | null;
};
type Access = {
  session: SessionInfo;
  logout: () => Promise<void>;
  error: string;
};
const Context = createContext<Access | null>(null);

export function useStaffAccess() {
  const access = useContext(Context);
  if (!access) throw new Error("Staff access provider missing");
  return access;
}

export function StaffAccess({ children }: { children: ReactNode }) {
  const { language } = useLocale();
  const text = (zh: string, en: string) => (language === "zh-HK" ? zh : en);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [key, setKey] = useState(
    () => sessionStorage.getItem("workflow-admin-key") || "",
  );
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const savedKey = sessionStorage.getItem("workflow-admin-key");
      const r = await fetch("/auth/session", {
        cache: "no-store",
        headers: savedKey ? { Authorization: `Bearer ${savedKey}` } : {},
      });
      if (!r.ok) throw new Error("Cannot verify staff session. Please retry.");
      const info: SessionInfo = await r.json();
      if (!["google", "local"].includes(info.mode))
        throw new Error("Cannot verify staff session. Please retry.");
      if (
        info.user &&
        (!["ADMIN", "SENIOR_NURSE"].includes(info.user.role) ||
          (info.mode === "google" && info.user.method !== "google"))
      )
        info.user = null;
      if (current !== requestId.current) return;
      setSession(info);
      setError("");
    } catch (e) {
      if (current !== requestId.current) return;
      setSession(null);
      setError((e as Error).message);
    } finally {
      if (current === requestId.current) setChecking(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const expired = () => {
      setSession(null);
      setChecking(true);
      void load();
    };
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("staff-session-expired", expired);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(() => void load(), 60000);
    return () => {
      requestId.current++;
      window.clearInterval(interval);
      window.removeEventListener("staff-session-expired", expired);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  useEffect(() => {
    if (!session?.user?.expires_at) return;
    const remaining = Date.parse(session.user.expires_at) - Date.now();
    const timer = window.setTimeout(
      () => {
        setSession(null);
        setChecking(true);
        void load();
      },
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(timer);
  }, [session?.user?.expires_at, load]);
  async function logout() {
    try {
      const r = await fetch("/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": session?.user?.csrf || "" },
      });
      if (!r.ok) throw new Error("Logout failed. Refresh and try again.");
      setSession(null);
      setChecking(true);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (session?.user)
    return (
      <Context.Provider value={{ session, logout, error }}>
        {children}
      </Context.Provider>
    );
  return (
    <main className="staff-access">
      <header className="staff-access-heading">
        <Logo />
        <LanguageSwitcher />
      </header>
      <section className="panel ev-panel">
        <LockKeyhole size={28} aria-hidden="true" />
        <h1>{text("職員登入", "Staff sign in")}</h1>
        {checking ? (
          <p role="status">{text("正在核實登入…", "Checking staff access…")}</p>
        ) : (
          <>
            <p>
              {text(
                "請使用獲准嘅職員帳戶登入 CareKnock。",
                "Sign in to CareKnock with an approved staff account.",
              )}
            </p>
            {session?.mode === "google" && (
              <a className="button primary" href="/auth/google">
                {text("使用 Google 登入", "Sign in with Google")}
              </a>
            )}
            {session?.mode === "local" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sessionStorage.setItem("workflow-admin-key", key);
                  setChecking(true);
                  void load();
                }}
              >
                <label>
                  {text("管理員金鑰", "Admin key")}
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    required
                  />
                </label>
                <button className="button primary" type="submit">
                  {text("登入", "Sign in")}
                </button>
              </form>
            )}
            {!session && (
              <button
                className="button secondary"
                onClick={() => {
                  setChecking(true);
                  void load();
                }}
              >
                {text("重新連線", "Retry connection")}
              </button>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <p>
          <a href="/#patient">{text("返回首頁", "Back to home")}</a>
        </p>
      </section>
    </main>
  );
}
