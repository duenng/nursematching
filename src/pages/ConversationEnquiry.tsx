import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";
import { useLocale } from "../i18n";
import { apiUrl } from "../lib/api";

type Draft = {
  reply: string;
  summary: string;
  care_needs: string;
  age: string;
  mobility: string;
  district: string;
  preferred_timing: string;
  service_ids: string[];
};
type Message = { role: "user" | "assistant"; content: string };

export function ConversationEnquiry() {
  const { language } = useLocale();
  const text = (zh: string, en: string) => (language === "zh-HK" ? zh : en);
  const [messages, setMessages] = useState<Message[]>([]);
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [review, setReview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState({ surname: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [provider, setProvider] = useState<"openai" | "openrouter" | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetch(apiUrl("/api/enquiries/assistant-config"), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Configuration unavailable");
        const config = await response.json();
        if (config.provider === "openai" || config.provider === "openrouter")
          setProvider(config.provider);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const providerName =
    provider === "openrouter"
      ? text("OpenRouter 及其模型供應商", "OpenRouter and its model provider")
      : provider === "openai"
        ? "OpenAI"
        : text("AI 服務供應商（載入中）", "AI provider (loading)");
  const userMessages = messages.filter((m) => m.role === "user");
  const hasDescription = !!description.trim() || userMessages.length > 0;
  const canOrganise = !!description.trim() || messages.at(-1)?.role === "user";

  async function request(path: string, body: unknown) {
    const response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(40000),
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error ||
          text(
            "未能完成，請重試。",
            "Could not complete the request. Please retry.",
          ),
      );
    return data;
  }
  async function organise() {
    const next: Message[] = description.trim()
      ? [...messages, { role: "user", content: description.trim() }]
      : messages;
    setMessages(next);
    setDescription("");
    setDraft(null);
    setError("");
    setBusy(true);
    try {
      const result: Draft = await request("/api/enquiries/assistant", {
        messages: next,
        language,
        consent: aiConsent,
      });
      setDraft(result);
      setMessages([...next, { role: "assistant", content: result.reply }]);
    } catch (e) {
      setError(
        (e as Error).name === "TimeoutError"
          ? text(
              "AI 回覆逾時，可重試或直接提交文字查詢。",
              "AI timed out. Retry or submit your description directly.",
            )
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function openReview() {
    if (description.trim()) {
      setMessages([...messages, { role: "user", content: description.trim() }]);
      setDescription("");
      setDraft(null);
    }
    setError("");
    setReviewed(false);
    setReview(true);
  }

  if (receipt)
    return (
      <section className="panel ev-panel" role="status">
        <h2>
          {text("已收到查詢", "Enquiry received")} · {receipt}
        </h2>
        <p>
          {text(
            "同事會透過電郵跟進，與你核實病人狀況及所需服務。",
            "Staff will follow up by email to confirm the patient's situation and care needs.",
          )}
        </p>
        <button
          className="button secondary"
          onClick={() => {
            setReceipt("");
            setMessages([]);
            setDescription("");
            setDraft(null);
            setReview(false);
            setReviewed(false);
            setConsent(false);
            setAiConsent(false);
            setContact({ surname: "", email: "", phone: "" });
          }}
        >
          {text("提交另一個查詢", "Submit another enquiry")}
        </button>
      </section>
    );

  return (
    <section
      className="panel ev-panel conversation-enquiry"
      aria-label={text("文字護理查詢", "Conversational care enquiry")}
    >
      <div className="conversation-intro">
        <span className="conversation-icon">
          <MessageCircle size={25} />
        </span>
        <div>
          <p className="eyebrow">
            {text("由你嘅描述開始", "START WITH YOUR WORDS")}
          </p>
          <h2>
            {review
              ? text("核對你的護理查詢", "Review your care enquiry")
              : text(
                  "請用一段文字說明病人狀況",
                  "Tell us about the patient in your own words",
                )}
          </h2>
        </div>
      </div>
      <p>
        {text(
          "可以講下病人年齡、最近身體狀況、行動能力，以及希望得到甚麼協助。知道地區或期望上門時間，也可以一併說明；未確定的可以之後再補充。",
          "Share the patient's age, recent condition, mobility and the help you are looking for. Include the district or preferred visit time if you know them; other details can be confirmed later.",
        )}
      </p>
      {error && (
        <p role="alert" className="ev-error">
          {error}
        </p>
      )}
      {messages.length > 0 && (
        <div
          className="conversation-messages"
          role="log"
          aria-label={text("查詢對話", "Enquiry conversation")}
          aria-live="polite"
        >
          {messages.map((message, i) => (
            <div className={`conversation-message ${message.role}`} key={i}>
              <strong>
                {message.role === "user"
                  ? text("你", "You")
                  : text("AI 查詢助手", "AI enquiry assistant")}
              </strong>
              <p>{message.content}</p>
            </div>
          ))}
        </div>
      )}
      {draft && (
        <section
          className="conversation-summary"
          aria-label={text("待確認摘要", "Summary to confirm")}
        >
          <h3>{text("待確認摘要", "Summary to confirm")}</h3>
          <p>{draft.summary}</p>
          <dl>
            {[
              [text("所需協助", "Care needs"), draft.care_needs],
              [text("年齡", "Age"), draft.age],
              [text("行動能力", "Mobility"), draft.mobility],
              [text("地區", "District"), draft.district],
              [text("期望時間", "Preferred timing"), draft.preferred_timing],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || text("待確認", "To confirm")}</dd>
              </div>
            ))}
          </dl>
          <p className="form-hint">
            {text(
              "AI 只協助整理你提供的資料，護理需要及服務安排由同事核實。如有不準確，可在下方補充更正。",
              "AI organises the details you provide. Staff confirm care needs and arrangements. Add a correction below if anything is inaccurate.",
            )}
          </p>
        </section>
      )}
      {!review ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void organise();
          }}
        >
          <label htmlFor="patient-description">
            {messages.length
              ? text(
                  "補充或更正病人狀況",
                  "Add details or correct the patient's situation",
                )
              : text("病人狀況描述", "Patient situation")}
          </label>
          <textarea
            id="patient-description"
            rows={6}
            maxLength={2000}
            disabled={busy || userMessages.length >= 16}
            placeholder={text(
              "例如：媽媽 78 歲，啱啱出院，行路要人扶，想搵護士上門照顧傷口。我哋住沙田，希望下星期開始。",
              "For example: Mum is 78 and has just left hospital. She needs help walking and we are looking for a nurse to help with her wound at home in Sha Tin, starting next week.",
            )}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="form-hint">
            {text(
              "毋須在描述中填寫姓名、身份證號碼、電話或詳細住址。",
              "You do not need to include names, ID numbers, phone numbers or a full address in your description.",
            )}
          </p>
          <label className="ev-check">
            <input
              type="checkbox"
              checked={aiConsent}
              disabled={busy || !provider}
              onChange={(e) => setAiConsent(e.target.checked)}
            />
            {text(
              `我同意將描述交由 ${providerName} 處理，以整理查詢及提出跟進問題。`,
              `I agree to send my description to ${providerName} to organise this enquiry and suggest follow-up questions.`,
            )}
          </label>
          {busy && (
            <p role="status">
              {text("正在整理你提供的資料…", "Organising your details…")}
            </p>
          )}
          <div className="ev-actions">
            <button
              className="button primary"
              type="submit"
              disabled={busy || !aiConsent || !canOrganise}
            >
              <Sparkles size={17} />
              {text("請 AI 幫我整理", "Organise with AI")}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy || !hasDescription}
              onClick={openReview}
            >
              {text("核對並留下聯絡方式", "Review and add contact details")}
              <ArrowRight size={17} />
            </button>
          </div>
          <p className="form-hint">
            {text(
              "亦可直接提交文字，由同事跟進，毋須使用 AI。",
              "You can also submit your description directly for staff follow-up without using AI.",
            )}
          </p>
        </form>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              const result = await request("/api/enquiries/conversation", {
                ...contact,
                messages: userMessages,
                draft,
                consent,
                reviewed,
                ai_consent: aiConsent,
              });
              setReceipt(result.id);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {text(
              "請核對以上原文及摘要；未確定的資料可由同事跟進。",
              "Review your original description and summary above. Staff can follow up any unknown details.",
            )}
          </p>
          <div className="ev-form-grid">
            <label>
              {text("聯絡人稱呼", "Contact name")}
              <input
                required
                maxLength={80}
                autoComplete="name"
                value={contact.surname}
                onChange={(e) =>
                  setContact({ ...contact, surname: e.target.value })
                }
              />
            </label>
            <label>
              {text("電郵（必填）", "Email (required)")}
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={contact.email}
                onChange={(e) =>
                  setContact({ ...contact, email: e.target.value })
                }
              />
            </label>
            <label>
              {text("電話（選填，8 位數字）", "Phone (optional, 8 digits)")}
              <input
                type="tel"
                pattern="[0-9]{8}"
                autoComplete="tel"
                value={contact.phone}
                onChange={(e) =>
                  setContact({ ...contact, phone: e.target.value })
                }
              />
            </label>
          </div>
          <label className="ev-check">
            <input
              required
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {text(
              "我已核對以上病人狀況及查詢內容。",
              "I have reviewed the patient description and enquiry details above.",
            )}
          </label>
          <label className="ev-check">
            <input
              required
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {text(
              "我同意將以上資料保存，用於跟進查詢、報價及安排服務。",
              "I agree that this information may be stored and used to follow up my enquiry, quote and arrange care.",
            )}
          </label>
          <div className="ev-actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setReview(false)}
            >
              {text("返回補充或修改", "Back to add or correct details")}
            </button>
            <button className="button primary" type="submit" disabled={busy}>
              {busy
                ? text("提交中…", "Submitting…")
                : text("確認提交查詢", "Confirm enquiry submission")}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      )}
      <p className="conversation-note">
        {text(
          "這是服務查詢，護理團隊會與你確認合適服務及報價。如病人正有胸痛、呼吸困難、失去知覺等緊急情況，請立即致電 999 或前往急症室。",
          "This is a service enquiry. The care team will confirm suitable services and a quotation with you. For current chest pain, difficulty breathing, loss of consciousness or another emergency, call 999 or attend A&E immediately.",
        )}
      </p>
    </section>
  );
}
