import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { englishOverrides, zhHK } from "./translations";

type Language = "zh-HK" | "en";
export const LANGUAGE_STORAGE_KEY = "kindred-language";
function initialLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "zh-HK";
  } catch {
    return "zh-HK";
  }
}
export function translateText(text: string, language: Language): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (language === "en") return englishOverrides[normalized] ?? text;
  if (Object.hasOwn(zhHK, normalized)) return zhHK[normalized];
  const patterns: [RegExp, (...parts: string[]) => string][] = [
    [
      /^(Good morning|Good afternoon|Good evening), Alex$/,
      (greeting) => `${zhHK[greeting]}，Alex`,
    ],
    [/^(\d+) to review$/, (count) => `${count} 次待審閱`],
    [/^(\d+) upcoming$/, (count) => `${count} 次即將到訪`],
    [/^ · Age (\d+)$/, (age) => ` · ${age} 歲`],
    [
      /^Review visit (\S+) at (\S+)$/,
      (date, time) => `核對到訪 ${date} ${time}`,
    ],
    [/^Open (HK-\d+)$/, (id) => `開啟 ${id}`],
    [/^YOUR CARE REQUEST · (.+)$/, (id) => `你的護理申請 · ${id}`],
    [/^Review (HK-\d+)$/, (id) => `審閱 ${id}`],
    [/^CARE REQUEST · (.+)$/, (id) => `護理申請 · ${id}`],
    [/^PROVIDER PROFILE · (.+)$/, (id) => `人員檔案 · ${id}`],
    [/^(.+) · Care visit$/, (name) => `${name} · 護理到訪`],
    [
      /^(.+) · SCHEDULE VERSION (\d+)$/,
      (id, version) => `${id} · 日程版本 ${version}`,
    ],
    [
      /^(.+) assigned after staff review\.$/,
      (name) => `職員審核後已委派 ${name}。`,
    ],
    [
      /^(\d+) proposed visits saved for family review\.$/,
      (count) => `已儲存 ${count} 次建議到訪，供家人審閱。`,
    ],
    [/^SCHEDULE VERSION (\d+)$/, (version) => `日程版本 ${version}`],
  ];
  for (const [pattern, format] of patterns) {
    const match = text.match(pattern);
    if (match) return format(...match.slice(1));
  }
  // Lists of standard labels (e.g. weekdays or clinical tasks). Never change stored values.
  const parts = text.split(/(,\s*| · )/);
  if (
    parts.length > 1 &&
    parts.every((part, index) => index % 2 || zhHK[part.trim()])
  ) {
    return parts
      .map((part, index) => (index % 2 ? part : zhHK[part.trim()]))
      .join("");
  }
  return text;
}

type Translate = {
  (value: string): string;
  <T>(value: T): T;
};
interface LocaleContext {
  language: Language;
  locale: "zh-HK" | "en-GB";
  setLanguage: (language: Language) => void;
  t: Translate;
}
const Context = createContext<LocaleContext | null>(null);
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "zh-HK"
        ? "CareKoala · 連繫每一份關懷"
        : "CareKoala · Care, connected.";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        language === "zh-HK"
          ? "CareKoala — 香港上門護理導航、陪診支援及護理協調。"
          : "CareKoala — a thoughtful home for home-care coordination in Hong Kong.",
      );
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Language switching remains available without persistent storage.
    }
  }, [language]);
  const t = ((value: unknown): unknown => {
    if (typeof value === "string") return translateText(value, language);
    if (Array.isArray(value)) return value.map((item) => t(item));
    return value;
  }) as Translate;
  return (
    <Context.Provider
      value={{
        language,
        locale: language === "zh-HK" ? "zh-HK" : "en-GB",
        setLanguage,
        t,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLocale() {
  const locale = useContext(Context);
  if (!locale) throw new Error("Locale provider missing");
  return locale;
}
export function LanguageSwitcher() {
  const { language, setLanguage } = useLocale();
  return (
    <div
      className="language-switcher"
      role="group"
      aria-label="語言 / Language"
    >
      <button
        type="button"
        lang="zh-HK"
        aria-pressed={language === "zh-HK"}
        onClick={() => setLanguage("zh-HK")}
      >
        繁中
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}
