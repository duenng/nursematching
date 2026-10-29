import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { CareCase, Page, Store } from "./types";
import { persistStore, readStore } from "./data";
import { uid } from "./lib/workflow";

export type Modal =
  | { type: "enquiry" }
  | { type: "case"; id: string }
  | { type: "schedule"; caseId?: string }
  | { type: "visit"; id: string }
  | { type: "provider"; id: string }
  | { type: "help" }
  | { type: "reset" }
  | { type: "patient-visit"; id: string }
  | { type: "patient-details"; id: string }
  | { type: "patient-support" }
  | null;
interface AppState {
  data: Store;
  update: (fn: (next: Store) => void) => void;
  page: Page;
  navigate: (page: Page) => void;
  modal: Modal;
  setModal: (modal: Modal) => void;
  toast: (message: string) => void;
  notification: string;
  patchCase: (id: string, fields: Partial<CareCase>, event?: string) => void;
  view: "patient" | "staff";
  switchView: (view: "patient" | "staff") => void;
  patientClientId: string;
  setPatientClientId: (id: string) => void;
}
const Context = createContext<AppState | null>(null);
export function useApp() {
  const app = useContext(Context);
  if (!app) throw new Error("App provider missing");
  return app;
}
export function logEvent(
  data: Store,
  text: string,
  detail: string,
  kind: "case" | "schedule" | "provider" | "message" = "case",
) {
  data.activities.unshift({
    id: uid(),
    text,
    detail,
    kind,
    time: new Date().toISOString(),
  });
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(readStore);
  const [page, setPage] = useState<Page>(
    window.location.hash === "#staff/email" ? "Email validation" : "Overview",
  );
  const [modal, setModal] = useState<Modal>(null);
  const [notification, setNotification] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [view, setView] = useState<"patient" | "staff">(
    window.location.hash.startsWith("#staff") ? "staff" : "patient",
  );
  const [patientClientId, setPatientClientId] = useState(() => {
    try {
      return localStorage.getItem("kindred-patient-preview") || "C-0023";
    } catch {
      return "C-0023";
    }
  });
  useEffect(() => {
    const change = () => {
      setModal(null);
      setView(window.location.hash.startsWith("#staff") ? "staff" : "patient");
      if (window.location.hash === "#staff/email") setPage("Email validation");
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("kindred-patient-preview", patientClientId);
    } catch {
      /* A preview still works when persistent browser storage is unavailable. */
    }
  }, [patientClientId]);
  const switchView = (next: "patient" | "staff") => {
    setModal(null);
    setView(next);
    window.location.hash = next;
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    try {
      persistStore(data);
    } catch {
      if (!storageError) {
        setNotification(
          "Browser storage is unavailable. Changes will last for this session only.",
        );
        setStorageError(true);
      }
    }
  }, [data, storageError]);
  useEffect(() => {
    if (!notification) return;
    const id = setTimeout(() => setNotification(""), 4500);
    return () => clearTimeout(id);
  }, [notification]);
  const update = (fn: (next: Store) => void) =>
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const navigate = (next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const patchCase = (id: string, fields: Partial<CareCase>, event?: string) =>
    update((next) => {
      const c = next.cases.find((c) => c.id === id);
      if (c) {
        Object.assign(c, fields, { updatedAt: new Date().toISOString() });
        if (event) logEvent(next, event, `${c.id} · ${c.name}`);
      }
    });
  return (
    <Context.Provider
      value={{
        data,
        update,
        page,
        navigate,
        modal,
        setModal,
        toast: setNotification,
        notification,
        patchCase,
        view,
        switchView,
        patientClientId,
        setPatientClientId,
      }}
    >
      {children}
    </Context.Provider>
  );
}
