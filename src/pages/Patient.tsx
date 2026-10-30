import { LanguageSwitcher, useLocale } from "../i18n";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Heart,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, Badge, EmptyState, Logo } from "../components";
import { PatientHomeIntro } from "./PatientHomeIntro";
import { useApp } from "../store";
import { Modals } from "../Modals";
import { localDate, today } from "../lib/workflow";
import { apiUrl } from "../lib/api";
import type { CareCase, Visit } from "../types";
import "../patient.css";

export function patientStatus(c: CareCase) {
  return {
    Submitted: "Your request has been received",
    "Manual review": "A team member is reviewing your request",
    "No doctor order": "Doctor instruction is required",
    "No first insertion": "This procedure is not provided",
    Quoted: "Your quotation is ready",
    "Awaiting payment": "Payment is due within 24 hours",
    "Payment expired": "The payment window has expired",
    Paid: "Payment received",
    Posted: "Finding a qualified nurse",
    Matched: "A nurse has accepted your request",
    Rematching: "Finding a replacement nurse",
    "Ready for service": "Your visit is ready",
    "Full refund": "A full refund is being processed",
    "Partial refund": "A refund is being processed",
    Cancelled: "This request is cancelled",
    "Information required": "A few details to clarify",
    "Under review": "Your request is being reviewed",
    "Ready to publish": "Getting ready to find your provider",
    "Awaiting providers": "Finding the right care provider",
    "Provider confirmed": "Your care provider is confirmed",
    "Service active": "Your care is underway",
    Completed: "Your care is complete",
  }[c.status];
}

export function PatientPortal() {
  const { t, language } = useLocale();

  const { data, setModal, notification, patientClientId } = useApp();
  const [section, setSection] = useState(
    window.location.hash.includes("/care") ? "care" : "home",
  );
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    const change = () =>
      setSection(window.location.hash.includes("/care") ? "care" : "home");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const cases = data.cases.filter((c) => c.clientId === patientClientId);
  const visits = data.visits
    .filter((v) => cases.some((c) => c.id === v.caseId))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const upcoming = visits.filter(
    (v) => v.date >= today() && v.status !== "Completed",
  );
  const proposed = visits.filter((v) => v.status === "Proposed").length;
  const latest = cases[0];
  function go(target: string) {
    setSection(target);
    setMobileMenu(false);
    window.location.hash = target === "care" ? "patient/care" : "patient";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function scrollTo(id: string) {
    setSection("home");
    setMobileMenu(false);
    window.location.hash = "patient";
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
    );
  }
  if (section === "home") return <PatientHomeIntro />;
  return (
    <div className={`patient-app ${section === "home" ? "patient-home" : ""}`}>
      <div className="patient-top-strip">
        <span>
          <Heart size={12} />
          {t("Thoughtful home care, across Hong Kong.")}
        </span>
        <div className="patient-top-actions">
          <LanguageSwitcher />
          <a href="/#enquire">
            {language === "zh-HK" ? "護理查詢" : "Care enquiry"}
          </a>
        </div>
      </div>
      <header className="patient-header">
        <div className="patient-header-inner">
          <button
            className="patient-brand-button"
            onClick={() => go("home")}
            aria-label={t("CareKnock home")}
          >
            <Logo />
          </button>
          <nav
            className={mobileMenu ? "patient-nav is-open" : "patient-nav"}
            aria-label={t("Patient navigation")}
          >
            <button
              className={section === "home" ? "active" : ""}
              onClick={() => go("home")}
            >
              {t("Home")}
            </button>
            <button onClick={() => scrollTo("our-services")}>
              {t("Our services")}
            </button>
            <button onClick={() => scrollTo("how-it-works")}>
              {t("How it works")}
            </button>
            <button onClick={() => scrollTo("common-questions")}>
              {t("FAQs")}
            </button>
            <button
              className={section === "care" ? "active" : ""}
              onClick={() => go("care")}
            >
              <UserRound size={15} />
              {t("My care")}
              {proposed > 0 && (
                <span className="patient-nav-count">{proposed}</span>
              )}
            </button>
            <a
              className="patient-staff-login"
              href={apiUrl("/auth/google")}
              aria-label={t("Staff sign in")}
            >
              <LockKeyhole size={15} />
              {t("Staff sign in")}
            </a>
          </nav>
          <div className="patient-header-actions">
            <button
              className="button primary"
              onClick={() => (window.location.hash = "enquire")}
            >
              {t("Enquire now")} <ArrowRight size={15} />
            </button>
            <button
              className="icon-button patient-mobile-menu"
              aria-label={t("Open patient menu")}
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      <main>
          <section className="patient-container patient-care-page">
            <div className="patient-care-heading">
              <div>
                <span className="patient-eyebrow">
                  {t("YOUR CARE, CONNECTED.")}
                </span>
                <h1>{t("A little clarity for the days ahead.")}</h1>
                <p>
                  {t("Your requests, visits and care provider, in one place.")}
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => (window.location.hash = "enquire")}
              >
                <Plus size={16} />
                {t("New care enquiry")}
              </button>
            </div>
            <div className="patient-demo-notice">
              <Sparkles size={18} />
              <p>
                <strong>
                  {t(
                    latest?.clientId === "C-0023"
                      ? "You’re exploring Mr. Chan’s sample patient journey."
                      : "You’re viewing the request you created in this demo.",
                  )}
                </strong>
                <span>
                  {t(
                    "Fictional data · Saved in this browser · No real services are booked",
                  )}
                </span>
              </p>
              <Badge tone="amber" dot={false}>
                {t("Patient preview")}
              </Badge>
            </div>
            {latest ? (
              <>
                <div className="patient-care-grid">
                  <div>
                    <section className="patient-request-card">
                      <div className="patient-card-header">
                        <h2>{t("Your care request")}</h2>
                        <span>{t(latest.id)}</span>
                      </div>
                      <div className="patient-request-person">
                        <Avatar
                          name={latest.name}
                          color={latest.color}
                          size="lg"
                        />
                        <div>
                          <h3>{latest.name}</h3>
                          <p>
                            <MapPin size={13} />
                            {t(latest.district || "District to confirm")}
                            {t(" ")}
                            {t(latest.age && ` · Age ${latest.age}`)}
                          </p>
                        </div>
                      </div>
                      <div className="patient-request-status">
                        <span className="patient-status-circle">
                          <Heart size={18} />
                        </span>
                        <div>
                          <strong>{t(patientStatus(latest))}</strong>
                          <p>
                            {t(
                              latest.status === "Awaiting providers"
                                ? "Your request has been reviewed. The care team will confirm an available provider with the right skills."
                                : latest.status === "Information required"
                                  ? "The team needs a few more details. You can add or correct your request below."
                                  : latest.status === "Under review"
                                    ? "Your details are saved for review by the care team."
                                    : "You can review your details and visits below.",
                            )}
                          </p>
                        </div>
                      </div>
                      <dl className="patient-request-details">
                        <div>
                          <dt>{t("Care requested")}</dt>
                          <dd>
                            {t(latest.care || "To be clarified together")}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("Preferred days")}</dt>
                          <dd>
                            {t(latest.days.join(", ") || "To be confirmed")}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("Preferred time")}</dt>
                          <dd>{t(latest.time || "To be confirmed")}</dd>
                        </div>
                        <div>
                          <dt>{t("Service duration")}</dt>
                          <dd>{t(latest.duration || "Not yet confirmed")}</dd>
                        </div>
                      </dl>
                      <button
                        className="patient-link"
                        onClick={() =>
                          setModal({ type: "patient-details", id: latest.id })
                        }
                      >
                        {t("Review or correct my details")}{" "}
                        <ArrowRight size={15} />
                      </button>
                    </section>
                    <section
                      className="patient-visits-card"
                      id="patient-visits"
                    >
                      <div className="patient-card-header">
                        <div>
                          <h2>{t("Your care schedule")}</h2>
                          <p>{t("Times shown in Hong Kong time (HKT).")}</p>
                        </div>
                        <Badge tone={proposed ? "amber" : "green"}>
                          {t(
                            proposed
                              ? `${proposed} to review`
                              : `${upcoming.length} upcoming`,
                          )}
                        </Badge>
                      </div>
                      {visits.length ? (
                        <div className="patient-visits-list">
                          {visits.map((v) => (
                            <PatientVisitCard
                              key={v.id}
                              visit={v}
                              careCase={cases.find((c) => c.id === v.caseId)!}
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title={t("Your schedule will appear here")}
                          description={t(
                            "Once the team has reviewed your requirements, you’ll be able to review proposed visits and request changes.",
                          )}
                        />
                      )}
                    </section>
                  </div>
                  <aside className="patient-care-rail">
                    <section className="patient-next-step">
                      <span className="patient-round-icon">
                        <CalendarDays size={25} />
                      </span>
                      <span className="patient-eyebrow">
                        {t("YOUR NEXT STEP")}
                      </span>
                      <h2>
                        {t(
                          proposed
                            ? "A schedule for your approval."
                            : "We’ll take it one step at a time.",
                        )}
                      </h2>
                      <p>
                        {t(
                          proposed
                            ? "Check the proposed dates and times below. You can approve a visit or ask for a time that suits you better."
                            : "Your enquiry is saved. The care team will review your needs before proposing care.",
                        )}
                      </p>
                      {proposed > 0 && (
                        <button
                          className="button primary"
                          onClick={() => {
                            const v = visits.find(
                              (v) => v.status === "Proposed",
                            );
                            if (v)
                              setModal({ type: "patient-visit", id: v.id });
                          }}
                        >
                          {t("Review a proposed visit")}{" "}
                          <ArrowRight size={15} />
                        </button>
                      )}
                    </section>
                    <section className="patient-provider-panel">
                      <h2>{t("Your care provider")}</h2>
                      {latest.providerId ? (
                        (() => {
                          const p = data.providers.find(
                            (p) => p.id === latest.providerId,
                          );
                          return p ? (
                            <>
                              <div className="patient-provider-person">
                                <Avatar name={p.name} color={p.color} />
                                <div>
                                  <strong>{p.name}</strong>
                                  <small>{t(p.category)}</small>
                                </div>
                                <ShieldCheck size={20} />
                              </div>
                              <p>
                                {t(
                                  "Assigned by the care team after checking relevant credentials and availability.",
                                )}
                              </p>
                            </>
                          ) : null;
                        })()
                      ) : (
                        <>
                          <span className="patient-provider-outline">
                            <HeartHandshake size={31} />
                          </span>
                          <h3>{t("The right person takes a little care.")}</h3>
                          <p>
                            {t(
                              "We’ll show your provider here once the care team confirms a suitable, available person.",
                            )}
                          </p>
                          <Badge dot={false}>{t("Not assigned yet")}</Badge>
                        </>
                      )}
                    </section>
                    <section className="patient-question-card">
                      <CircleHelp size={24} />
                      <h3>{t("Something you’d like to clarify?")}</h3>
                      <p>
                        {t(
                          "Add a question for the care team about your request or schedule.",
                        )}
                      </p>
                      <button
                        className="patient-link"
                        onClick={() => setModal({ type: "patient-support" })}
                      >
                        {t("Ask a question")} <MessageCircle size={15} />
                      </button>
                    </section>
                  </aside>
                </div>
              </>
            ) : (
              <EmptyState
                title={t("Your next chapter starts here")}
                description={t(
                  "Share a little about the support you need to create a care enquiry.",
                )}
                action={
                  <button
                    className="button primary"
                    onClick={() => (window.location.hash = "enquire")}
                  >
                    {t("Start my enquiry")} <ArrowRight size={15} />
                  </button>
                }
              />
            )}
          </section>
      </main>
      <footer className="patient-footer">
        <div className="patient-container">
          <div className="patient-footer-main">
            <div>
              <Logo />
              <p>
                {t("A little support. A world of difference.")}
                <br />
                {t("Home nursing navigation & coordination in Hong Kong.")}
              </p>
            </div>
            <div>
              <strong>{t("Here to help")}</strong>
              <button onClick={() => scrollTo("our-services")}>
                {t("Our services")}
              </button>
              <button onClick={() => scrollTo("how-it-works")}>
                {t("How it works")}
              </button>
              <button onClick={() => scrollTo("common-questions")}>
                {t("Common questions")}
              </button>
            </div>
            <div>
              <strong>{t("Your care journey")}</strong>
              <button onClick={() => (window.location.hash = "enquire")}>
                {t("Start an enquiry")}
              </button>
              <button onClick={() => go("care")}>
                {t("My care & schedule")}
              </button>
            </div>
          </div>
          <div className="patient-footer-bottom">
            <span>{t("CareKnock · Hong Kong")}</span>
            <span>
              {t(
                "Not monitored for emergencies. For an immediate emergency in Hong Kong, call 999.",
              )}
            </span>
          </div>
        </div>
      </footer>
      <Modals />
      {notification && (
        <div className="toast patient-toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {t(notification)}
        </div>
      )}
    </div>
  );
}
function PatientVisitCard({
  visit,
  careCase,
}: {
  visit: Visit;
  careCase: CareCase;
}) {
  const { t, locale } = useLocale();

  const { setModal } = useApp();
  const d = localDate(visit.date);
  return (
    <button
      className={`patient-visit-row ${visit.status === "Proposed" ? "proposed" : ""}`}
      onClick={() => setModal({ type: "patient-visit", id: visit.id })}
      aria-label={t(`Review visit ${visit.date} at ${visit.time}`)}
    >
      <span className="patient-visit-date">
        <span>{t(d.toLocaleDateString(locale, { month: "short" }))}</span>
        <strong>{d.getDate()}</strong>
        <small>{t(d.toLocaleDateString(locale, { weekday: "short" }))}</small>
      </span>
      <span className="patient-visit-info">
        <strong>{t(visit.tasks)}</strong>
        <span>
          <Clock3 size={12} />
          {t(visit.time)} · {visit.duration} {t("min")}{" "}
          <span>· {careCase.name}</span>
        </span>
        {visit.changeRequest && (
          <small className="patient-change-pending">
            {t("Time change requested · awaiting the team")}
          </small>
        )}
      </span>
      <span className="patient-visit-action">
        <Badge
          tone={
            visit.status === "Proposed"
              ? "amber"
              : visit.status === "Confirmed"
                ? "green"
                : visit.status === "Completed"
                  ? "blue"
                  : "red"
          }
        >
          {t(visit.status === "Proposed" ? "For your approval" : visit.status)}
        </Badge>
        <span>
          {t(visit.status === "Proposed" ? "Review visit" : "View details")}
          <ChevronRight size={14} />
        </span>
      </span>
    </button>
  );
}
