import { LanguageSwitcher, useLocale } from "./i18n";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Plus,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { CareCase } from "./types";
import { initials, localDate, today } from "./lib/workflow";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="M20 32S5 24 8 14c2-6 10-6 12 0 3-6 11-6 13 0 3 10-13 18-13 18Z"
            fill="currentColor"
          />
          <path
            d="M15 20h10m-5-5v10"
            stroke="#750f6d"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          Care<span className="brand-care">Knock</span>
        </span>
      )}
    </div>
  );
}
export function Avatar({
  name,
  color = "green",
  size = "md",
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { t } = useLocale();

  return <span className={`avatar ${color} ${size}`}>{t(initials(name))}</span>;
}
export function Badge({
  children,
  tone = "neutral",
  dot = true,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
export function CaseBadge({ status }: { status: CareCase["status"] }) {
  const { t } = useLocale();

  const tone = {
    Submitted: "amber",
    "Manual review": "amber",
    "No doctor order": "neutral",
    "No first insertion": "neutral",
    Quoted: "purple",
    "Awaiting payment": "amber",
    "Payment expired": "neutral",
    Paid: "green",
    Posted: "purple",
    Matched: "blue",
    Rematching: "amber",
    "Ready for service": "green",
    "Full refund": "green",
    "Partial refund": "amber",
    Cancelled: "neutral",
    "Under review": "amber",
    "Information required": "amber",
    "Ready to publish": "green",
    "Awaiting providers": "purple",
    "Provider confirmed": "blue",
    "Service active": "green",
    Completed: "neutral",
  }[status];
  return <Badge tone={tone}>{t(status)}</Badge>;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{t(eyebrow)}</div>
        <h1>{t(title)}</h1>
        <p>{t(description)}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className="empty-state">
      <span className="empty-symbol">
        <Plus size={24} />
      </span>
      <h3>{t(title)}</h3>
      <p>{t(description)}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  required = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  const { t } = useLocale();

  return (
    <label className="field">
      <span>
        {t(label)}
        {required && <em> *</em>}
      </span>
      {children}
      {hint && <small>{t(hint)}</small>}
    </label>
  );
}
export function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  label?: string;
}) {
  const { t } = useLocale();

  return (
    <span className="select-wrap">
      <select
        aria-label={t(label)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) =>
          typeof option === "string" ? (
            <option value={option} key={option}>
              {t(option)}
            </option>
          ) : (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ),
        )}
      </select>
      <ChevronDown size={14} />
    </span>
  );
}
export function ModalFrame({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const { t } = useLocale();

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialogRef.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            {eyebrow && <div className="eyebrow">{t(eyebrow)}</div>}
            <h2 id="modal-title">{t(title)}</h2>
          </div>
          <div className="modal-header-actions">
            <LanguageSwitcher />
            <button
              className="icon-button"
              onClick={onClose}
              aria-label={t("Close dialog")}
            >
              <X size={20} />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Trend({
  up = true,
  children,
}: {
  up?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`trend ${up ? "positive" : "muted"}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />} {children}
    </span>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  const { t } = useLocale();

  return (
    <button
      className={`toggle ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={t(label)}
      onClick={onChange}
    >
      <span>{checked && <Check size={10} />}</span>
    </button>
  );
}
export function DateLabel() {
  const { t, locale } = useLocale();

  return (
    <span>
      {t(
        localDate(today()).toLocaleDateString(locale, {
          weekday: "short",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      )}
    </span>
  );
}
