import { useLocale } from "../i18n";
import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  Database,
  Download,
  CreditCard,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  Mail,
  MessageCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { logEvent, useApp } from "../store";
import { Avatar, Badge, EmptyState, PageTitle, Select } from "../components";
import { broadcastText, today, uid } from "../lib/workflow";

export function ProvidersPage() {
  const { t } = useLocale();

  const { data, setModal, navigate } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All provider types");
  const [availability, setAvailability] = useState("All providers");
  const filtered = data.providers.filter(
    (p) =>
      `${p.name} ${p.districts.join(" ")} ${p.skills.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "All provider types" || category === p.category) &&
      (availability === "All providers" ||
        (availability === "Available now" && p.available && p.verified) ||
        (availability === "Verification pending" && !p.verified)),
  );
  return (
    <>
      <PageTitle
        eyebrow={t("GOOD PEOPLE. THOUGHTFUL CARE.")}
        title={t("Care providers")}
        description={t(
          "A trusted community of nurses and companions, ready to lend a hand.",
        )}
      >
        <button
          className="button secondary"
          onClick={() => navigate("Care requests")}
        >
          <Users size={16} />
          {t("Review applications")}
        </button>
      </PageTitle>
      <div className="provider-intro">
        <div className="provider-intro-icon">
          <HeartHandshake size={29} />
        </div>
        <div>
          <h2>{t("The right person makes all the difference.")}</h2>
          <p>
            {data.providers.filter((p) => p.verified).length}{" "}
            {t("verified providers ·")}{" "}
            {data.providers.filter((p) => p.verified && p.available).length}
            {t(" ")}
            {t("currently available · Across Hong Kong")}
          </p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={13} />
          {t("Verified with care")}
        </Badge>
      </div>
      <div className="standalone-filter filter-bar">
        <label className="table-search">
          <Search size={16} />
          <input
            aria-label={t("Search providers")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search providers, districts or skills...")}
          />
        </label>
        <div>
          <Select
            label={t("Provider type")}
            value={category}
            onChange={setCategory}
            options={[
              "All provider types",
              "Registered nurse",
              "Enrolled nurse",
              "Care companion",
            ]}
          />
          <Select
            label={t("Provider availability")}
            value={availability}
            onChange={setAvailability}
            options={["All providers", "Available now", "Verification pending"]}
          />
        </div>
      </div>
      <div className="provider-grid">
        {filtered.map((p) => (
          <button
            className="provider-card panel"
            key={p.id}
            onClick={() => setModal({ type: "provider", id: p.id })}
          >
            <div className="provider-card-top">
              <Avatar name={p.name} color={p.color} size="lg" />
              <Badge tone={p.available && p.verified ? "green" : "neutral"}>
                {t(
                  p.verified
                    ? p.available
                      ? "Available"
                      : "At capacity"
                    : "Pending verification",
                )}
              </Badge>
            </div>
            <h3>
              {p.name}
              {p.verified && <ShieldCheck size={17} />}
            </h3>
            <p className="provider-category">{t(p.category)}</p>
            <span className="provider-experience">
              {t(p.experience)} {t("years of experience")}
            </span>
            <div className="provider-districts">
              <MapPin size={14} />
              {t(p.districts.join(" · "))}
            </div>
            <div className="skill-tags">
              {p.skills.slice(0, 2).map((s) => (
                <span key={s}>{t(s)}</span>
              ))}
              {p.skills.length > 2 && <span>+{t(p.skills.length - 2)}</span>}
            </div>
            <div className="provider-card-footer">
              <span>
                {p.verified ? (
                  <>
                    <ShieldCheck size={13} />
                    {t("Credentials checked · demo")}
                  </>
                ) : (
                  <>{t("Verification required")}</>
                )}
              </span>
              <ArrowRight size={16} />
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState
          title={t("No providers in this view")}
          description={t("Try another district, skill or provider type.")}
        />
      )}
      <div className="inline-note">
        <LockKeyhole size={17} />
        <p>
          {t(
            "All profiles use fictional demonstration data. Credentials, competencies and availability must be verified before any real assignment.",
          )}
        </p>
      </div>
    </>
  );
}
export function MessagesPage() {
  const { t, locale } = useLocale();

  const { data, navigate, toast } = useApp();
  const [filter, setFilter] = useState("All messages");
  const filtered = data.messages.filter(
    (m) => filter === "All messages" || m.type === filter,
  );
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Message copied.");
    } catch {
      toast(
        "Copy is unavailable in this browser. Select the message text to copy.",
      );
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={t("KEEP EVERYONE IN THE LOOP.")}
        title={t("Care messages")}
        description={t(
          "Case opportunities and visit reminders, all in one thoughtful thread.",
        )}
      >
        <button
          className="button secondary"
          onClick={() => navigate("Settings")}
        >
          {t("Integration settings")} <ArrowRight size={15} />
        </button>
      </PageTitle>
      <section className="messaging-banner">
        <span className="email-icon">
          <MessageCircle size={29} />
        </span>
        <div>
          <Badge tone="amber" dot={false}>
            {t("SIMULATED IN THIS PROTOTYPE")}
          </Badge>
          <h2>{t("A familiar channel for better coordination.")}</h2>
          <p>
            {t(
              "Preview privacy-conscious case broadcasts and visit reminders.",
            )}
            <br />
            {t(
              "Legacy previews stay in this browser. Open Email validation for the server workflow.",
            )}
          </p>
        </div>
        <div className="connection-label">
          <span />
          {t("Email validation available")}
        </div>
      </section>
      <div className="section-bar">
        <h2>
          {t("Message activity")}
          {t(" ")}
          <span className="number-pill">{data.messages.length}</span>
        </h2>
        <Select
          label={t("Message type")}
          value={filter}
          onChange={setFilter}
          options={["All messages", "Broadcast", "Reminder"]}
        />
      </div>
      {filtered.length ? (
        <div className="message-grid">
          {filtered.map((m) => (
            <section className="message-card panel" key={m.id}>
              <div className="message-header">
                <span
                  className={`activity-icon ${m.type === "Broadcast" ? "provider" : "message"}`}
                >
                  {m.type === "Broadcast" ? (
                    <Users size={18} />
                  ) : (
                    <Bell size={18} />
                  )}
                </span>
                <div>
                  <strong>
                    {t(
                      m.type === "Broadcast"
                        ? "Provider case broadcast"
                        : "Scheduled visit reminder",
                    )}
                  </strong>
                  <small>
                    {t(m.caseId)} ·{t(" ")}
                    {t(
                      new Date(m.createdAt).toLocaleString(locale, {
                        timeZone: "Asia/Hong_Kong",
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    )}
                  </small>
                </div>
                <Badge tone="amber" dot={false}>
                  {t("Simulated")}
                </Badge>
              </div>
              <div className="message-bubble">
                <pre>{t(m.content)}</pre>
                <span>
                  <CheckCheck size={15} />
                  {t("Preview only · no delivery")}
                </span>
              </div>
              <div className="message-card-footer">
                <span>
                  <ShieldCheck size={13} />
                  {t(
                    m.type === "Broadcast"
                      ? "Patient-identifying details excluded"
                      : "Sent only to the assigned provider in production",
                  )}
                </span>
                <button className="text-button" onClick={() => copy(m.content)}>
                  <Copy size={14} />
                  {t("Copy text")}
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title={t("Good communication starts here")}
            description={t(
              "Publish an approved care request or simulate a confirmed visit reminder to see it here.",
            )}
            action={
              <button
                className="button primary"
                onClick={() => navigate("Care requests")}
              >
                {t("View care requests")} <ArrowRight size={15} />
              </button>
            }
          />
        </section>
      )}
      <div className="info-callout">
        <ShieldCheck size={22} />
        <div>
          <strong>
            {t("Designed for an authorised messaging integration.")}
          </strong>
          <p>
            {t(
              "Use Email validation for individual test emails, confirmation links and server event records. SMTP delivery requires test recipient settings.",
            )}
          </p>
        </div>
      </div>
    </>
  );
}
export function SettingsPage() {
  const { t } = useLocale();

  const { data, setModal, toast, update, navigate } = useApp();
  const [mockCaseId, setMockCaseId] = useState(data.cases[0]?.id || "");
  const [mockProviderId, setMockProviderId] = useState(
    data.providers[0]?.id || "",
  );
  const mockCase = data.cases.find((item) => item.id === mockCaseId);
  const mockProvider = data.providers.find(
    (item) => item.id === mockProviderId,
  );
  function mockQuote() {
    if (!mockCase) return;
    update((next) => {
      const c = next.cases.find((item) => item.id === mockCase.id)!;
      c.quoteTotal = c.quoteTotal ?? 1220;
      c.quoteVersion = (c.quoteVersion ?? 0) + 1;
      c.paymentStatus = "Quoted";
      c.status = "Quoted";
      logEvent(
        next,
        "Mock quotation generated",
        `${c.id} · HK$${c.quoteTotal}`,
        "case",
      );
    });
    toast("Mock quotation generated — no real customer message sent.");
  }
  function mockPayment() {
    if (!mockCase) return;
    update((next) => {
      const c = next.cases.find((item) => item.id === mockCase.id)!;
      const now = new Date();
      const deadline = new Date(
        now.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString();
      c.quoteTotal = c.quoteTotal ?? 1220;
      c.paymentStatus = "Paid";
      c.paymentLink = `mock://checkout/${c.id}`;
      c.paymentLinkSentAt = now.toISOString();
      c.paymentDeadline = deadline;
      c.paidAt = now.toISOString();
      c.amountPaid = c.quoteTotal;
      c.status = "Paid";
      next.mockPayments = next.mockPayments ?? [];
      next.mockPayments.unshift({
        id: uid(),
        caseId: c.id,
        amount: c.quoteTotal,
        status: "Paid",
        createdAt: now.toISOString(),
        deadline,
        provider: "Mock checkout",
      });
      logEvent(
        next,
        "Mock payment received",
        `${c.id} · HK$${c.amountPaid}`,
        "case",
      );
    });
    toast("Mock payment marked paid. No real money was charged.");
  }
  function mockExpire() {
    if (!mockCase) return;
    update((next) => {
      const c = next.cases.find((item) => item.id === mockCase.id)!;
      c.paymentStatus = "Payment expired";
      c.status = "Payment expired";
      c.cancellationType = "Payment timeout";
      next.mockPayments = (next.mockPayments ?? []).map((payment) =>
        payment.caseId === c.id
          ? { ...payment, status: "Expired" as const }
          : payment,
      );
      logEvent(
        next,
        "Mock payment expired",
        `${c.id} · automatic cancellation`,
        "case",
      );
    });
    toast("Mock 24-hour payment expiry applied.");
  }
  function mockRefund() {
    if (!mockCase) return;
    update((next) => {
      const c = next.cases.find((item) => item.id === mockCase.id)!;
      c.refundAmount = c.amountPaid ?? c.quoteTotal ?? 0;
      c.refundStatus = "Paid";
      c.paymentStatus = "Not quoted";
      c.status = "Full refund";
      c.cancellationType = "Mock no provider / cancellation";
      next.mockPayments = (next.mockPayments ?? []).map((payment) =>
        payment.caseId === c.id
          ? { ...payment, status: "Refunded" as const }
          : payment,
      );
      logEvent(
        next,
        "Mock full refund completed",
        `${c.id} · HK$${c.refundAmount}`,
        "case",
      );
    });
    toast("Mock refund completed. No real payment was reversed.");
  }
  function mockDispatch() {
    if (!mockCase) return;
    update((next) => {
      const c = next.cases.find((item) => item.id === mockCase.id)!;
      c.status = "Posted";
      c.dispatchStatus = "Posted";
      c.postedAt = new Date().toISOString();
      c.repostCount = (c.repostCount ?? 0) + 1;
      next.messages.unshift({
        id: uid(),
        caseId: c.id,
        content: `[MOCK EMAIL]\n${broadcastText(c)}`,
        createdAt: new Date().toISOString(),
        type: "Broadcast",
        status: "Simulated",
      });
      logEvent(
        next,
        "Mock email dispatch sent",
        `${c.id} · verified nurse sandbox`,
        "message",
      );
    });
    toast("Mock email dispatch recorded in Messages.");
  }
  function mockAssign() {
    if (!mockCase || !mockProvider) return;
    update((next) => {
      const c = next.cases.find((item) => item.id === mockCase.id)!;
      const p = next.providers.find((item) => item.id === mockProvider.id)!;
      if (p.nurseStatus !== "已核實" || !p.verified || !p.optIn) return;
      c.providerId = p.id;
      c.assignedAt = new Date().toISOString();
      c.status = "Matched";
      c.dispatchStatus = "Assigned";
      c.addressStatus = "Requested privately";
      logEvent(
        next,
        "Mock first-come provider assigned",
        `${c.id} · ${p.name}`,
        "provider",
      );
    });
    toast("Mock first eligible provider assigned.");
  }
  function mockDrop() {
    if (!mockCase || !mockProvider) return;
    update((next) => {
      const c = next.cases.find((item) => item.id === mockCase.id)!;
      const p = next.providers.find((item) => item.id === mockProvider.id)!;
      p.dropCount = (p.dropCount ?? 0) + 1;
      p.dropLog = [
        ...(p.dropLog ?? []),
        {
          caseId: c.id,
          at: new Date().toISOString(),
          reason: "Mock nurse cancellation",
        },
      ];
      if ((p.dropCount ?? 0) >= 3) p.nurseStatus = "暫停";
      c.status = "Rematching";
      c.dispatchStatus = "Posted";
      c.providerId = undefined;
      logEvent(
        next,
        "Mock nurse cancellation; rematch started",
        `${c.id} · ${p.name} · strike ${p.dropCount}`,
        "provider",
      );
    });
    toast("Mock nurse drop recorded; rematching started.");
  }
  function mockVerifyNurse() {
    if (!mockProvider) return;
    update((next) => {
      const p = next.providers.find((item) => item.id === mockProvider.id)!;
      p.nurseStatus = "已核實";
      p.verified = true;
      p.optIn = true;
      p.rnVerifiedAt = new Date().toISOString();
      p.interviewResult = "通過";
      p.interviewDate = today();
      logEvent(
        next,
        "Mock RN onboarding verified",
        `${p.id} · interview + i-Learn checked`,
        "provider",
      );
    });
    toast("Mock nurse interview and i-Learn verification passed.");
  }
  function exportBackup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `carekoala-demo-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Demo workspace backup downloaded.");
  }
  return (
    <>
      <PageTitle
        eyebrow={t("A WORKSPACE THAT WORKS FOR YOU.")}
        title={t("Workspace settings")}
        description={t(
          "A clear view of what’s connected, what’s local, and what comes next.",
        )}
      />
      <div className="info-callout" style={{ marginBottom: 24 }}>
        <Mail size={24} />
        <div>
          <strong>{t("Email validation")}</strong>
          <p>
            {t(
              "Use Email validation for individual test emails, confirmation links and server event records. SMTP delivery requires test recipient settings.",
            )}
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => navigate("Email validation")}
        >
          {t("Email validation")} <ArrowRight size={16} />
        </button>
      </div>
      <div className="settings-layout">
        <section className="panel settings-panel">
          <h2>{t("Workspace details")}</h2>
          <div className="settings-row">
            <span>
              <strong>{t("Workspace")}</strong>
              <small>{t("Home-care navigation & coordination")}</small>
            </span>
            <span>{t("CareKoala · Hong Kong")}</span>
          </div>
          <div className="settings-row">
            <span>
              <strong>{t("Time zone")}</strong>
              <small>
                {t("All scheduled visits use local care-team time")}
              </small>
            </span>
            <Badge dot={false}>{t("Asia/Hong_Kong · UTC+8")}</Badge>
          </div>
          <div className="settings-row">
            <span>
              <strong>{t("Environment")}</strong>
              <small>
                {t("Interactive frontend with fictional sample data")}
              </small>
            </span>
            <Badge tone="amber" dot={false}>
              {t("Prototype")}
            </Badge>
          </div>
          <div className="settings-row">
            <span>
              <strong>{t("Staff account")}</strong>
              <small>{t("Role shown for demonstration only")}</small>
            </span>
            <span>{t("Alex Chan · Care coordinator")}</span>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>{t("Connections & capabilities")}</h2>
          <div className="integration-row">
            <span className="integration-icon green">
              <Database size={22} />
            </span>
            <div>
              <strong>{t("Browser storage")}</strong>
              <p>{t("Cases, schedules and events persist in this browser.")}</p>
            </div>
            <Badge tone="green">{t("Operational")}</Badge>
          </div>
          <div className="integration-row">
            <span className="integration-icon purple">
              <Sparkles size={22} />
            </span>
            <div>
              <strong>{t("Enquiry extraction")}</strong>
              <p>
                {t(
                  "Inspectable English / Traditional Chinese rules. No live AI model.",
                )}
              </p>
            </div>
            <Badge tone="amber" dot={false}>
              {t("Rules-based demo")}
            </Badge>
          </div>
          <div className="integration-row">
            <span className="integration-icon green">
              <MessageCircle size={22} />
            </span>
            <div>
              <strong>{t("Test email")}</strong>
              <p>{t("Message previews and reminder simulation only.")}</p>
            </div>
            <Badge dot={false}>{t("Not connected")}</Badge>
          </div>
          <div className="integration-row">
            <span className="integration-icon blue">
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>{t("Authentication & secure database")}</strong>
              <p>{t("To be connected during backend development.")}</p>
            </div>
            <Badge dot={false}>{t("Planned")}</Badge>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>{t("Demo data")}</h2>
          <div className="settings-row">
            <span>
              <strong>{t("Download workspace data")}</strong>
              <small>{t("Export the current demo records as JSON")}</small>
            </span>
            <button className="button secondary" onClick={exportBackup}>
              <Download size={16} />
              {t("Download backup")}
            </button>
          </div>
          <div className="settings-row">
            <span>
              <strong>{t("Reset demo workspace")}</strong>
              <small>
                {t(
                  "Replace browser-saved changes with the original sample records",
                )}
              </small>
            </span>
            <button
              className="button danger-secondary"
              onClick={() => setModal({ type: "reset" })}
            >
              <RotateCcw size={15} />
              {t("Reset demo")}
            </button>
          </div>
        </section>
        <section className="panel settings-panel mock-sandbox">
          <div className="mock-sandbox-heading">
            <div>
              <h2>
                <CreditCard size={19} /> {t("Mock integrations sandbox")}
              </h2>
              <p>
                {t(
                  "Run the v2 payment, email, dispatch, refund and nurse onboarding flows locally. Nothing is sent or charged.",
                )}
              </p>
            </div>
            <Badge tone="amber" dot={false}>
              {t("MOCK ONLY")}
            </Badge>
          </div>
          <div className="form-grid mock-controls">
            <label className="field">
              <span>{t("Demo case")}</span>
              <select
                aria-label={t("Demo case")}
                value={mockCaseId}
                onChange={(e) => setMockCaseId(e.target.value)}
              >
                {data.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Demo nurse")}</span>
              <select
                aria-label={t("Demo nurse")}
                value={mockProviderId}
                onChange={(e) => setMockProviderId(e.target.value)}
              >
                {data.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mock-flow-status">
            <Badge tone="purple" dot={false}>
              {mockCase?.status || "—"}
            </Badge>
            <span>{mockCase?.paymentStatus || t("No payment yet")}</span>
            <span>{mockCase?.dispatchStatus || t("Not posted")}</span>
            <span>{mockProvider?.nurseStatus || t("Status not recorded")}</span>
            {mockProvider && (
              <span>
                {t("Strikes")}: {mockProvider.dropCount ?? 0}/3
              </span>
            )}
          </div>
          <div className="mock-action-grid">
            <button className="button secondary" onClick={mockQuote}>
              {t("1 · Generate mock quote")}
            </button>
            <button className="button secondary" onClick={mockPayment}>
              {t("2 · Mark mock payment paid")}
            </button>
            <button className="button secondary" onClick={mockExpire}>
              {t("Expire 24-hour payment")}
            </button>
            <button className="button secondary" onClick={mockDispatch}>
              {t("3 · Send mock email dispatch")}
            </button>
            <button className="button secondary" onClick={mockAssign}>
              {t("4 · First eligible nurse accepts")}
            </button>
            <button className="button secondary" onClick={mockDrop}>
              {t("Mock nurse cancels / rematch")}
            </button>
            <button className="button secondary" onClick={mockRefund}>
              {t("Mock full refund")}
            </button>
            <button className="button secondary" onClick={mockVerifyNurse}>
              {t("Mock interview + i-Learn pass")}
            </button>
          </div>
          <p className="form-hint">
            {t(
              "Mock checkout: 24-hour deadline · Mock email: message log only · Mock refunds: browser data only · Three mock nurse drops pause the nurse.",
            )}
          </p>
        </section>
      </div>
      <div className="inline-note">
        <LockKeyhole size={18} />
        <p>
          {t(
            "This frontend has no access controls or secure server storage. Please use fictional information while exploring the prototype.",
          )}
        </p>
        <button
          className="text-button"
          onClick={() => setModal({ type: "help" })}
        >
          {t("Prototype guide")} <ChevronRight size={14} />
        </button>
      </div>
      <div className="prototype-status-grid">
        <div>
          <Check size={16} />
          <span>{t("Interactive workflows")}</span>
        </div>
        <div>
          <Check size={16} />
          <span>{t("Editable care requests")}</span>
        </div>
        <div>
          <Check size={16} />
          <span>{t("Schedule revisions & approval")}</span>
        </div>
        <div>
          <ArrowDownToLine size={16} />
          <span>{t("CSV & JSON exports")}</span>
        </div>
      </div>
    </>
  );
}
