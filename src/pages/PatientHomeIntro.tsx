import { useLocale } from "../i18n";
import { useState } from "react";
import { ArrowRight, Check, Heart, ShieldCheck } from "lucide-react";

const services = [
  {
    title: "Nursing care at home",
    chinese: "上門護士護理",
    image: "/images/care-team.jpg",
    alt: "A medical professional with a stethoscope",
    description:
      "Nursing support for needs such as wound care, based on confirmed professional instructions. The team reviews the appropriate RN or EN scope and relevant skills before arranging care.",
  },
  {
    title: "Support after hospital",
    chinese: "出院護理支援",
    image: "/images/home-care.jpg",
    alt: "A caregiver supporting an older adult at home",
    description:
      "Make the move from hospital to home more manageable. Share your discharge instructions so the team can help coordinate the right support and a visit schedule you agree to.",
  },
  {
    title: "Health monitoring",
    chinese: "健康監察支援",
    image: "/images/nursing-care.jpg",
    alt: "A stethoscope beside a care professional’s laptop",
    description:
      "Ask about support with tasks such as blood pressure or blood glucose monitoring. A qualified reviewer confirms the requested tasks, professional requirements and visit frequency with you.",
  },
  {
    title: "Appointment companions",
    chinese: "陪診及覆診支援",
    image: "/images/companion-care.jpg",
    alt: "Two women talking together at a table",
    description:
      "Non-clinical support at hospital and clinic appointments, from finding your way to keeping your family informed. The team checks district coverage and companion availability.",
  },
  {
    title: "A plan built around you",
    chinese: "個人化護理安排",
    image: "/images/welcome-care.jpg",
    alt: "Hands held together in support",
    description:
      "Not sure which service to choose? Tell us what day-to-day life looks like for you. The team helps clarify your needs, explains the options and reviews the proposed plan with you.",
  },
];

type Props = {
  onEnquire: () => void;
  onExploreCare: () => void;
  onSeeProcess: () => void;
};

export function PatientHomeIntro({
  onEnquire,
  onExploreCare,
  onSeeProcess,
}: Props) {
  const { t, language } = useLocale();

  const [showServices, setShowServices] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  function revealServices(title: string | null) {
    setSelectedService(title);
    setShowServices(true);
    requestAnimationFrame(() => {
      document.getElementById("clinic-service-details")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
  }

  return (
    <>
      <section className="clinic-hero" aria-labelledby="clinic-hero-title">
        <div className="patient-container clinic-hero-content">
          <span className="clinic-eyebrow">
            {t("COMPASSIONATE CARE. CLOSER TO HOME.")}
          </span>
          <h1 id="clinic-hero-title">
            {t("A little help at home.")}
            <br />
            {t("A lot of peace of mind.")}
          </h1>
          <p>
            {t(
              "Thoughtful nursing care and appointment support for you and the people you love. Let’s find your next step, together.",
            )}
          </p>
          <button className="button clinic-peach-button" onClick={onEnquire}>
            {t("Find the right care")} <ArrowRight size={19} />
          </button>
          <span className="clinic-hero-location">
            {t("HOME NURSING & CARE NAVIGATION · HONG KONG")}
          </span>
        </div>
      </section>

      <section className="clinic-welcome">
        <div className="patient-container clinic-split">
          <div className="clinic-welcome-copy">
            <span className="clinic-eyebrow">
              {t("WELCOME TO KINDRED CARE")}
            </span>
            <h2>
              {t("A helping hand.")}
              <br />
              {t("A more comfortable home.")}
            </h2>
            <p>
              {t(
                "Finding care can feel like a lot to take on. We’re here to make the next step feel a little easier, whether you’re arranging support for yourself or someone close to you.",
              )}
            </p>
            <p>
              {t(
                "From home nursing to a companion for appointments, start with what you need. We’ll help bring the details together.",
              )}
            </p>
            <button
              className="button clinic-purple-button"
              onClick={onSeeProcess}
            >
              {t("Get to know our approach")} <ArrowRight size={18} />
            </button>
          </div>
          <div className="clinic-welcome-image">
            <img
              src="/images/home-care.jpg"
              alt={t(
                "A caregiver helping an older adult sit comfortably at home",
              )}
              width="1400"
              height="933"
              loading="lazy"
            />
            <div className="clinic-image-caption">
              <Heart size={24} strokeWidth={1.5} />
              <span>
                {t("Care starts with")}{" "}
                <strong>{t("understanding you.")}</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="clinic-services" id="our-services">
        <div className="patient-container">
          <div className="clinic-centered-heading">
            <span className="clinic-eyebrow">
              {t("OUR SERVICES · 上門護理服務")}
            </span>
            <h2>{t("How we help")}</h2>
            <p>
              {t(
                "The right support, for wherever you are in your care journey.",
              )}
            </p>
          </div>
          <div className="clinic-service-grid">
            {services.map((service) => (
              <article className="clinic-service" key={service.title}>
                <button
                  className="clinic-service-button"
                  aria-expanded={
                    showServices && selectedService === service.title
                  }
                  aria-controls="clinic-service-details"
                  onClick={() => revealServices(service.title)}
                >
                  <span className="clinic-service-image">
                    <img
                      src={service.image}
                      alt={t(service.alt)}
                      loading="lazy"
                      width="360"
                      height="440"
                    />
                    <span className="clinic-service-arrow">
                      <ArrowRight size={19} />
                    </span>
                  </span>
                  <h3>{t(service.title)}</h3>
                  <span className="clinic-service-chinese">
                    {language === "en" ? service.chinese : service.title}
                  </span>
                </button>
              </article>
            ))}
          </div>
          <div className="clinic-service-actions">
            <button
              className="button clinic-purple-button"
              aria-expanded={showServices}
              aria-controls="clinic-service-details"
              onClick={() => {
                if (showServices && !selectedService) {
                  setShowServices(false);
                } else {
                  revealServices(null);
                }
              }}
            >
              {t(
                showServices && !selectedService
                  ? "Close service details"
                  : "View all services",
              )}
              <ArrowRight size={18} />
            </button>
          </div>
          <div
            id="clinic-service-details"
            hidden={!showServices}
            className="clinic-service-details"
          >
            {services
              .filter(
                (service) =>
                  !selectedService || selectedService === service.title,
              )
              .map((service) => (
                <div key={service.title}>
                  <h4>{t(service.title)}</h4>
                  <p>{t(service.description)}</p>
                  <button className="patient-link" onClick={onEnquire}>
                    {t("Enquire about this service")} <ArrowRight size={17} />
                  </button>
                </div>
              ))}
          </div>
          <p className="clinic-service-note">
            <ShieldCheck size={18} />
            {t(
              "Clinical needs and professional scope are reviewed before care is arranged.",
            )}
          </p>
        </div>
      </section>

      <section className="clinic-provider">
        <div className="patient-container clinic-split">
          <div className="clinic-provider-image">
            <img
              src="/images/care-provider.jpg"
              alt={t("A Hong Kong senior-care volunteer supporting an older adult indoors")}
              loading="lazy"
              width="1400"
              height="933"
            />
            <span className="clinic-photo-label">
              {t("Illustrative stock photography")}
            </span>
          </div>
          <div className="clinic-provider-copy">
            <span className="clinic-eyebrow">
              {t("PEOPLE AT THE HEART OF YOUR CARE")}
            </span>
            <h2>
              {t("The right people.")}
              <br />
              {t("A little more reassurance.")}
            </h2>
            <p>
              {t(
                "Every care journey is personal. Our approach brings your needs, the right professional skills and a schedule that works for you into one clear plan.",
              )}
            </p>
            <h3>{t("Care, with you in mind")}</h3>
            <ul>
              <li>
                <Check size={19} />
                {t("Credentials and relevant skills checked before assignment")}
              </li>
              <li>
                <Check size={19} />
                {t("Care needs reviewed by people")}
              </li>
              <li>
                <Check size={19} />
                {t("Clear service details and pricing for your agreement")}
              </li>
              <li>
                <Check size={19} />
                {t("Proposed visits you can review and approve")}
              </li>
            </ul>
            <button
              className="button clinic-peach-button"
              onClick={onExploreCare}
            >
              {t("Explore your care journey")} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
