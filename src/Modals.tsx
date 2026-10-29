import { useLocale } from "./i18n";
import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardList,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useApp, logEvent } from "./store";
import {
  Avatar,
  Badge,
  CaseBadge,
  EmptyState,
  Field,
  ModalFrame,
  Select,
} from "./components";
import { createSeed } from "./data";
import {
  broadcastText,
  canPublish,
  DISTRICTS,
  SERVICE_ITEMS,
  calculateQuote,
  extractEnquiry,
  parsePreferredTimes,
  RECENT_CONDITIONS,
  remoteAreaTier,
  validateServiceWindow,
  validPreferredTimes,
  localDate,
  missingFields,
  providerEligible,
  scheduleConflict,
  servicePathway,
  shortDate,
  today,
  uid,
  WEEK_DAYS,
} from "./lib/workflow";
import type { CareCase, Category, Visit } from "./types";
import {
  PatientDetailsModal,
  PatientSupportModal,
  PatientVisitModal,
} from "./PatientModals";

const CATEGORIES: Category[] = [
  "Needs review",
  "Registered nurse",
  "Enrolled nurse",
  "Care companion",
];
export function Modals() {
  const { modal, setModal } = useApp();
  if (!modal) return null;
  const close = () => setModal(null);
  switch (modal.type) {
    case "enquiry":
      return <EnquiryModal onClose={close} />;
    case "case":
      return <CaseModal key={modal.id} id={modal.id} onClose={close} />;
    case "schedule":
      return <ScheduleModal caseId={modal.caseId} onClose={close} />;
    case "visit":
      return <VisitModal key={modal.id} id={modal.id} onClose={close} />;
    case "provider":
      return <ProviderModal id={modal.id} onClose={close} />;
    case "help":
      return <HelpModal onClose={close} />;
    case "reset":
      return <ResetModal onClose={close} />;
    case "patient-visit":
      return <PatientVisitModal key={modal.id} id={modal.id} onClose={close} />;
    case "patient-details":
      return (
        <PatientDetailsModal key={modal.id} id={modal.id} onClose={close} />
      );
    case "patient-support":
      return <PatientSupportModal onClose={close} />;
  }
}

const SAMPLE =
  "我媽媽78歲，最近出院，患有糖尿病，腳部有傷口。我想搵護士幫佢處理傷口及監察血糖。屋企喺沙田，希望星期一至五下午安排服務。";
function EnquiryModal({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();

  const { data, update, toast, setModal, view, setPatientClientId } = useApp();
  const isPatient = view === "patient";
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [extracted, setExtracted] = useState<ReturnType<
    typeof extractEnquiry
  > | null>(null);
  const [linkedClient, setLinkedClient] = useState("");
  const [followup, setFollowup] = useState("");
  const [followups, setFollowups] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState<CareCase["status"] | "">(
    "",
  );
  const [guided, setGuided] = useState(false);
  const [structured, setStructured] = useState({
    surname: "",
    age: "",
    gender: "",
    weightKg: "",
    heightCm: "",
    district: "",
    building: "",
    mobility: "",
    conditions: [] as string[],
    doctorOrderStatus: "",
    tubeStatus: {} as Record<string, string>,
    companion: "",
    other: "",
    services: [] as string[],
    serviceTimes: {} as Record<string, string>,
    prn: [] as string[],
    timeCategory: "Day" as "Day" | "Night 10 hours" | "Night 12 hours",
    serviceDates: [today()],
    startTime: "09:00",
    endTime: "13:00",
    email: "",
    phone: "",
  });
  const pathway = servicePathway(text);
  const missing = extracted ? missingFields(extracted) : [];
  function analyse() {
    setWorkflowStatus("");
    if (guided) {
      const next = structured;
      if (
        !next.surname ||
        !next.age ||
        Number(next.age) < 0 ||
        Number(next.age) > 120 ||
        !next.gender ||
        !next.weightKg ||
        !next.heightCm ||
        !next.district ||
        !next.building ||
        !next.mobility ||
        !next.companion ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email) ||
        (next.phone !== "" && !/^\d{8}$/.test(next.phone)) ||
        !next.services.length ||
        !next.serviceDates.length
      ) {
        setError("Please complete all required guided-form fields.");
        return;
      }
      if (
        !validateServiceWindow(next.timeCategory, next.startTime, next.endTime)
      ) {
        setError(
          "Daytime service must be within 07:00–22:00; night services use fixed times.",
        );
        return;
      }
      const needsDoctor = next.services.some(
        (id) =>
          SERVICE_ITEMS.find((item) => item.id === id)?.doctorOrderRequired,
      );
      const tubeItems = next.services.filter(
        (id) => SERVICE_ITEMS.find((item) => item.id === id)?.tubeOnly,
      );
      if (needsDoctor && !next.doctorOrderStatus) {
        setError("Please tell us whether a doctor’s instruction is available.");
        return;
      }
      if (tubeItems.some((id) => !next.tubeStatus[id])) {
        setError("Please tell us whether each selected tube already exists.");
        return;
      }
      if (needsDoctor && next.doctorOrderStatus === "No")
        setWorkflowStatus("No doctor order");
      else if (needsDoctor && next.doctorOrderStatus === "Unsure")
        setWorkflowStatus("Manual review");
      else if (
        tubeItems.some((id) => next.tubeStatus[id] === "First insertion")
      )
        setWorkflowStatus("No first insertion");
      else if (tubeItems.some((id) => next.tubeStatus[id] === "Unsure"))
        setWorkflowStatus("Manual review");
      for (const id of next.services) {
        const times = parsePreferredTimes(next.serviceTimes[id] || "");
        if (
          times.length &&
          !validPreferredTimes(
            times,
            next.timeCategory,
            next.startTime,
            next.endTime,
          )
        ) {
          setError(
            "Preferred times must use HH:MM and fall within the selected service window.",
          );
          return;
        }
      }
      setText(
        `${next.surname} structured enquiry with selected care services and visit details`,
      );
    }
    if (!guided && text.trim().length < 15) {
      setError(
        "Please share a little more about the care needed (at least 15 characters).",
      );
      return;
    }
    if (!consent) {
      setError("Please acknowledge the demo data notice to continue.");
      return;
    }
    const parsed = extractEnquiry(text);
    if (guided) {
      const selections = structured.services.map((id) => {
        const item = SERVICE_ITEMS.find((entry) => entry.id === id)!;
        return {
          itemId: item.id,
          label: item.label,
          category: item.category,
          preferredTimes: parsePreferredTimes(
            structured.serviceTimes[id] || "",
          ),
          prn: structured.prn.includes(id),
          tubeOnly: item.tubeOnly,
          doctorOrderRequired: item.doctorOrderRequired,
        };
      });
      Object.assign(parsed, {
        name: structured.surname,
        age: structured.age,
        district: structured.district,
        care: selections.map((s) => s.label).join(", "),
        contact: structured.email,
        days: ["Mon"],
        time: `${structured.startTime}–${structured.endTime}`,
        duration:
          structured.timeCategory === "Day"
            ? "Day visit"
            : structured.timeCategory,
        background: structured.conditions.join(", "),
      });
    }
    setExtracted(parsed);
    setStep(1);
    setError("");
  }
  function followUp() {
    if (!followup.trim() || !extracted) return;
    const combined = extractEnquiry(
      `${text}\n${followups.join("\n")}\n${followup}`,
    );
    setExtracted({
      ...extracted,
      ...Object.fromEntries(
        Object.entries(combined).filter(([key, value]) =>
          key === "days"
            ? (value as string[]).length
            : !!value && value !== "Needs review",
        ),
      ),
    });
    setFollowups([...followups, followup]);
    setFollowup("");
    toast("New details added. Please check the updated fields.");
  }
  function save() {
    if (!extracted) return;
    if (!extracted.name.trim()) {
      setError("Add a patient name or a fictional alias before saving.");
      return;
    }
    const num =
      Math.max(
        0,
        ...data.cases.map((c) => Number(c.id.replace("HK-", "")) || 0),
      ) + 1;
    const id = `HK-${String(num).padStart(4, "0")}`;
    update((next) => {
      const clientId = linkedClient || `C-${String(num).padStart(4, "0")}`;
      const now = new Date().toISOString();
      const c: CareCase = {
        ...extracted,
        id,
        clientId,
        status:
          workflowStatus ||
          (missing.length ? "Information required" : "Under review"),
        original:
          text +
          (followups.length
            ? `\n\nFollow-up messages:\n${followups.join("\n")}`
            : ""),
        date: today(),
        createdAt: now,
        updatedAt: now,
        color: ["peach", "blue", "lavender", "green"][num % 4],
        consent,
        clinicalReviewed: false,
        familyAgreed: false,
        priceConfirmed: false,
        approved: false,
        applications: [],
        ...(guided
          ? {
              email: structured.email,
              phone: structured.phone,
              gender: structured.gender as "Male" | "Female",
              building: structured.building,
              weightKg: structured.weightKg,
              heightCm: structured.heightCm,
              mobility: structured.mobility,
              recentConditions: structured.conditions,
              doctorOrderStatus: structured.doctorOrderStatus as
                "Yes" | "No" | "Unsure" | undefined,
              tubeStatus: structured.tubeStatus as CareCase["tubeStatus"],
              companion: structured.companion as
                "Yes" | "No" | "Part of the time",
              services: structured.services.map((serviceId) => {
                const item = SERVICE_ITEMS.find(
                  (entry) => entry.id === serviceId,
                )!;
                return {
                  itemId: item.id,
                  label: item.label,
                  category: item.category,
                  preferredTimes: parsePreferredTimes(
                    structured.serviceTimes[serviceId] || "",
                  ),
                  prn: structured.prn.includes(serviceId),
                  tubeOnly: item.tubeOnly,
                  doctorOrderRequired: item.doctorOrderRequired,
                };
              }),
              otherNeedText: structured.other,
              timeCategory: structured.timeCategory,
              serviceDates: structured.serviceDates,
              startTime: structured.startTime,
              endTime: structured.endTime,
              dispatchStatus: "Not posted" as const,
              addressStatus: "Not requested" as const,
              remoteTier: remoteAreaTier(
                structured.district,
                structured.building,
              ),
              nurseTravelAllowance: ["A", "B"].includes(
                remoteAreaTier(structured.district, structured.building),
              )
                ? 150
                : 0,
              quoteLines: (() => {
                try {
                  return calculateQuote({
                    dates: structured.serviceDates,
                    category: structured.timeCategory,
                    start: structured.startTime,
                    end: structured.endTime,
                  }).lines;
                } catch {
                  return [];
                }
              })(),
              quoteTotal: (() => {
                try {
                  return calculateQuote({
                    dates: structured.serviceDates,
                    category: structured.timeCategory,
                    start: structured.startTime,
                    end: structured.endTime,
                  }).total;
                } catch {
                  return undefined;
                }
              })(),
              quoteVersion: 1,
              paymentStatus: workflowStatus
                ? ("Not quoted" as const)
                : ("Quoted" as const),
            }
          : {}),
      };
      next.cases.unshift(c);
      logEvent(
        next,
        "A new care enquiry is ready",
        `${c.name} · ${c.district || "District to confirm"}`,
      );
    });
    if (isPatient) {
      setPatientClientId(linkedClient || `C-${String(num).padStart(4, "0")}`);
      setModal(null);
      window.location.hash = "patient/care";
      toast("Your enquiry is saved. You can review it in My care.");
    } else {
      toast("Enquiry saved and linked to a client record.");
      setModal({ type: "case", id });
    }
  }
  return (
    <ModalFrame
      title={t(
        step === 0
          ? "A little about the care you need"
          : "Let’s get the details right",
      )}
      eyebrow={t("CARE NAVIGATOR")}
      onClose={onClose}
      wide
    >
      <div className="modal-steps">
        <span className={step === 0 ? "current" : "done"}>
          <i>{step > 0 ? <Check size={12} /> : "1"}</i>
          {t("Share the story")}
        </span>
        <div />
        <span className={step === 1 ? "current" : ""}>
          <i>2</i>
          {t("Review the details")}
        </span>
      </div>
      {step === 0 ? (
        <div className="modal-body">
          <div className="navigator-greeting">
            <span className="navigator-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <strong>
                {t("Every care journey starts with a conversation.")}
              </strong>
              <p>
                {t(
                  "Tell us who needs support, where they live, and what help you’re looking for. English and 中文 are both welcome.",
                )}
              </p>
            </div>
          </div>
          <Field label={t("How can we help?")} required>
            {!guided && (
              <textarea
                className="enquiry-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t(
                  "For example: My mum is 78 and has just come home from hospital. We live in Sha Tin and need help with her wound care on weekday afternoons…",
                )}
                rows={6}
              />
            )}
          </Field>
          <button
            className="sample-button"
            type="button"
            onClick={() => setGuided(!guided)}
          >
            <ClipboardList size={14} />{" "}
            {guided
              ? t("Use free-text enquiry")
              : t("Use the structured care form")}
          </button>
          {guided && (
            <div className="guided-enquiry-form">
              <div className="form-grid">
                <Field label={t("Patient surname")} required>
                  <input
                    aria-label={t("Patient surname")}
                    value={structured.surname}
                    onChange={(e) =>
                      setStructured({ ...structured, surname: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("Gender")} required>
                  <Select
                    label={t("Gender")}
                    value={structured.gender}
                    onChange={(gender) =>
                      setStructured({ ...structured, gender })
                    }
                    options={[
                      { value: "", label: "Select" },
                      { value: "Male", label: "Male · 男" },
                      { value: "Female", label: "Female · 女" },
                    ]}
                  />
                </Field>
                <Field label={t("Age")} required>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    aria-label={t("Patient age (years)")}
                    value={structured.age}
                    onChange={(e) =>
                      setStructured({ ...structured, age: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("District")} required>
                  <Select
                    label={t("District")}
                    value={structured.district}
                    onChange={(district) =>
                      setStructured({ ...structured, district })
                    }
                    options={[
                      { value: "", label: "Select district" },
                      ...DISTRICTS,
                    ]}
                  />
                </Field>
                <Field label={t("Building / estate / village")} required>
                  <input
                    aria-label={t("Building / estate / village")}
                    value={structured.building}
                    onChange={(e) =>
                      setStructured({ ...structured, building: e.target.value })
                    }
                    placeholder={t("Unit number is collected privately later")}
                  />
                </Field>
                <Field label={t("Weight (kg)")} required>
                  <input
                    type="number"
                    aria-label={t("Weight (kg)")}
                    value={structured.weightKg}
                    onChange={(e) =>
                      setStructured({ ...structured, weightKg: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("Height (cm)")} required>
                  <input
                    type="number"
                    aria-label={t("Height (cm)")}
                    value={structured.heightCm}
                    onChange={(e) =>
                      setStructured({ ...structured, heightCm: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("Email address")} required>
                  <input
                    type="email"
                    aria-label={t("Email address")}
                    value={structured.email}
                    onChange={(e) =>
                      setStructured({ ...structured, email: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("Phone (optional, 8 digits)")}>
                  <input
                    type="tel"
                    aria-label={t("Phone (optional, 8 digits)")}
                    value={structured.phone}
                    onChange={(e) =>
                      setStructured({ ...structured, phone: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label={t("Mobility")} required>
                <Select
                  label={t("Mobility")}
                  value={structured.mobility}
                  onChange={(mobility) =>
                    setStructured({ ...structured, mobility })
                  }
                  options={[
                    { value: "", label: "Select" },
                    "Needs assistance",
                    "Bedbound",
                    "Wheelchair",
                    "Walking frame",
                    "Can go out independently",
                  ]}
                />
              </Field>
              <Field label={t("Someone at home during service")} required>
                <Select
                  label={t("Someone at home during service")}
                  value={structured.companion}
                  onChange={(companion) =>
                    setStructured({ ...structured, companion })
                  }
                  options={[
                    { value: "", label: "Select" },
                    "Yes",
                    "No",
                    "Part of the time",
                  ]}
                />
              </Field>
              <Field label={t("Recent conditions in the last 3 months")}>
                <div className="condition-grid">
                  {RECENT_CONDITIONS.map((condition) => (
                    <label className="checkbox-row" key={condition}>
                      <input
                        type="checkbox"
                        checked={structured.conditions.includes(condition)}
                        onChange={(e) =>
                          setStructured({
                            ...structured,
                            conditions: e.target.checked
                              ? [...structured.conditions, condition]
                              : structured.conditions.filter(
                                  (item) => item !== condition,
                                ),
                          })
                        }
                      />
                      <span>{t(condition)}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <div className="guided-section">
                <strong>{t("Care services · select all that apply")}</strong>
                {(["A", "B", "C"] as const).map((category) => (
                  <div key={category}>
                    <h4>
                      {category === "A"
                        ? t("A · Basic care")
                        : category === "B"
                          ? t("B · Doctor instruction required")
                          : t("C · Non-clinical support")}
                    </h4>
                    {SERVICE_ITEMS.filter(
                      (item) => item.category === category,
                    ).map((item) => (
                      <div className="guided-service-row" key={item.id}>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={structured.services.includes(item.id)}
                            onChange={(e) =>
                              setStructured({
                                ...structured,
                                services: e.target.checked
                                  ? [...structured.services, item.id]
                                  : structured.services.filter(
                                      (id) => id !== item.id,
                                    ),
                              })
                            }
                          />
                          <span>
                            {t(item.label)}
                            <small>{t(item.zh)}</small>
                          </span>
                        </label>
                        {structured.services.includes(item.id) && (
                          <>
                            <input
                              aria-label={`${item.label} preferred times`}
                              placeholder="08:00, 12:00"
                              value={structured.serviceTimes[item.id] || ""}
                              onChange={(e) =>
                                setStructured({
                                  ...structured,
                                  serviceTimes: {
                                    ...structured.serviceTimes,
                                    [item.id]: e.target.value,
                                  },
                                })
                              }
                            />
                            <label className="checkbox-row">
                              <input
                                type="checkbox"
                                checked={structured.prn.includes(item.id)}
                                onChange={(e) =>
                                  setStructured({
                                    ...structured,
                                    prn: e.target.checked
                                      ? [...structured.prn, item.id]
                                      : structured.prn.filter(
                                          (id) => id !== item.id,
                                        ),
                                  })
                                }
                              />
                              <span>{t("As needed (PRN)")}</span>
                            </label>
                            {item.tubeOnly && (
                              <Select
                                label={`${item.label} tube status`}
                                value={structured.tubeStatus[item.id] || ""}
                                onChange={(value) =>
                                  setStructured({
                                    ...structured,
                                    tubeStatus: {
                                      ...structured.tubeStatus,
                                      [item.id]: value,
                                    },
                                  })
                                }
                                options={[
                                  { value: "", label: "Tube status" },
                                  "Existing",
                                  "First insertion",
                                  "Unsure",
                                ]}
                              />
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {structured.services.some(
                (id) =>
                  SERVICE_ITEMS.find((item) => item.id === id)
                    ?.doctorOrderRequired,
              ) && (
                <Field label={t("Doctor instruction / prescription")} required>
                  <Select
                    label={t("Doctor instruction / prescription")}
                    value={structured.doctorOrderStatus}
                    onChange={(doctorOrderStatus) =>
                      setStructured({ ...structured, doctorOrderStatus })
                    }
                    options={[
                      { value: "", label: "Select" },
                      "Yes",
                      "No",
                      "Unsure",
                    ]}
                  />
                </Field>
              )}
              <Field label={t("Visit period")} required>
                <Select
                  label={t("Visit period")}
                  value={structured.timeCategory}
                  onChange={(timeCategory) =>
                    setStructured({
                      ...structured,
                      timeCategory:
                        timeCategory as typeof structured.timeCategory,
                      startTime:
                        timeCategory === "Day" ? structured.startTime : "22:00",
                      endTime:
                        timeCategory === "Day"
                          ? structured.endTime
                          : timeCategory === "Night 10 hours"
                            ? "08:00"
                            : "10:00",
                    })
                  }
                  options={["Day", "Night 10 hours", "Night 12 hours"]}
                />
              </Field>
              <div className="form-grid">
                <Field label={t("Service date")} required>
                  <input
                    type="date"
                    aria-label={t("Service date")}
                    value={structured.serviceDates[0]}
                    onChange={(e) =>
                      setStructured({
                        ...structured,
                        serviceDates: [e.target.value],
                      })
                    }
                  />
                </Field>
                <Field label={t("Start time")} required>
                  <input
                    type="time"
                    aria-label={t("Start time")}
                    value={structured.startTime}
                    disabled={structured.timeCategory !== "Day"}
                    onChange={(e) =>
                      setStructured({
                        ...structured,
                        startTime: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label={t("End time")} required>
                  <input
                    type="time"
                    aria-label={t("End time")}
                    value={structured.endTime}
                    disabled={structured.timeCategory !== "Day"}
                    onChange={(e) =>
                      setStructured({ ...structured, endTime: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label={t("Other care need")}>
                <input
                  value={structured.other}
                  onChange={(e) =>
                    setStructured({ ...structured, other: e.target.value })
                  }
                  placeholder={t("Optional; reviewed by staff")}
                />
              </Field>
            </div>
          )}
          <button className="sample-button" onClick={() => setText(SAMPLE)}>
            <MessageCircle size={14} />
            {t("Try a Cantonese example")} <ArrowRight size={13} />
          </button>
          <div className="info-callout small">
            <Sparkles size={17} />
            <p>
              {t(
                "This prototype uses a rules-based extractor, not a live AI model. Unclear or missing details will stay unconfirmed.",
              )}
            </p>
          </div>
          {pathway.urgent && (
            <div className="error-box">
              <AlertCircle size={18} />
              {t(pathway.reason)}
            </div>
          )}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              {t(
                "I’m using fictional information for this demo and agree to save this enquiry in this browser.",
              )}
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          )}
        </div>
      ) : (
        extracted && (
          <div className="modal-body">
            {guided &&
              (() => {
                try {
                  const quote = calculateQuote({
                    dates: structured.serviceDates,
                    category: structured.timeCategory,
                    start: structured.startTime,
                    end: structured.endTime,
                  });
                  return (
                    <div className="info-callout quote-preview">
                      <ShieldCheck size={17} />
                      <p>
                        <strong>{t("Quote preview")}</strong>
                        <br />
                        {quote.lines
                          .map(
                            (line) =>
                              `${line.date} · HK$${line.subtotal.toLocaleString()} (${line.billableHours} hours)`,
                          )
                          .join(" · ")}
                        <br />
                        <small>
                          {t(
                            "Materials and tools are supplied by the client. Remote travel allowance is paid by the platform, not added to your quote.",
                          )}
                        </small>
                      </p>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}
            <div className="review-layout">
              <div>
                <div className="subsection-label">
                  <FileText size={15} />
                  {t("STRUCTURED ENQUIRY")}
                  {t(" ")}
                  <Badge tone="amber" dot={false}>
                    {t("Draft")}
                  </Badge>
                </div>
                <div className="form-grid">
                  <Field label={t("Patient name / alias")} required>
                    <input
                      value={extracted.name}
                      onChange={(e) =>
                        setExtracted({ ...extracted, name: e.target.value })
                      }
                      placeholder={t("Not provided — please add")}
                    />
                  </Field>
                  <Field label={t("Patient age")}>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={extracted.age}
                      onChange={(e) =>
                        setExtracted({ ...extracted, age: e.target.value })
                      }
                      placeholder={t("Unknown")}
                    />
                  </Field>
                  <Field label={t("Service district")}>
                    <Select
                      value={extracted.district}
                      onChange={(v) =>
                        setExtracted({ ...extracted, district: v })
                      }
                      options={[
                        { value: "", label: "Not yet confirmed" },
                        ...DISTRICTS,
                      ]}
                      label={t("Enquiry service district")}
                    />
                  </Field>
                  <Field label={t("Contact details")}>
                    <input
                      value={extracted.contact}
                      onChange={(e) =>
                        setExtracted({ ...extracted, contact: e.target.value })
                      }
                      placeholder={t("Not provided")}
                    />
                  </Field>
                  <Field label={t("Care requested")}>
                    <input
                      value={extracted.care}
                      onChange={(e) =>
                        setExtracted({ ...extracted, care: e.target.value })
                      }
                      placeholder={t("To be confirmed")}
                    />
                  </Field>
                  <Field label={t("Medical background")}>
                    <input
                      value={extracted.background}
                      onChange={(e) =>
                        setExtracted({
                          ...extracted,
                          background: e.target.value,
                        })
                      }
                      placeholder={t("Not provided")}
                    />
                  </Field>
                  <Field label={t("Preferred time")}>
                    <input
                      value={extracted.time}
                      onChange={(e) =>
                        setExtracted({ ...extracted, time: e.target.value })
                      }
                      placeholder={t("Not yet confirmed")}
                    />
                  </Field>
                  <Field label={t("Service duration")}>
                    <input
                      value={extracted.duration}
                      onChange={(e) =>
                        setExtracted({ ...extracted, duration: e.target.value })
                      }
                      placeholder={t("Not yet confirmed")}
                    />
                  </Field>
                </div>
                <Field label={t("Preferred service days")}>
                  <DayPicker
                    days={extracted.days}
                    onChange={(days) => setExtracted({ ...extracted, days })}
                  />
                </Field>
                {!isPatient && (
                  <Field
                    label={t("Link to an existing client")}
                    hint={t(
                      "Select only if you have confirmed this is the same person. No automatic name matching.",
                    )}
                  >
                    <Select
                      value={linkedClient}
                      onChange={setLinkedClient}
                      label={t("Existing client")}
                      options={[
                        { value: "", label: "Create a new client record" },
                        ...[...new Set(data.cases.map((c) => c.clientId))].map(
                          (id) => ({
                            value: id,
                            label: `${data.cases.find((c) => c.clientId === id)?.name} · ${id}`,
                          }),
                        ),
                      ]}
                    />
                  </Field>
                )}
              </div>
              <aside className="review-aside">
                <div className="pathway-note">
                  <ShieldCheck size={22} />
                  <h3>{t("A suggestion, with oversight.")}</h3>
                  <Badge
                    tone={
                      extracted.category === "Needs review" ? "amber" : "green"
                    }
                  >
                    {t(extracted.category)}
                  </Badge>
                  <p>{t(pathway.reason)}</p>
                </div>
                <div className="missing-panel">
                  <h4>
                    {t(
                      missing.length
                        ? "A few things to clarify"
                        : "The key details are captured",
                    )}
                    <span>{missing.length}</span>
                  </h4>
                  {missing.map((item) => (
                    <span key={item}>
                      <span className="tiny-dot" />
                      {t(item)}
                    </span>
                  ))}
                  {!missing.length && (
                    <p>
                      {t(
                        "Staff will review the details before the case progresses.",
                      )}
                    </p>
                  )}
                </div>
              </aside>
            </div>
            <div className="followup-box">
              <strong>
                <MessageCircle size={16} />
                {t("Anything else to add?")}
              </strong>
              <p>
                {t(
                  missing.includes("Service duration")
                    ? "How long will you need the service? "
                    : "",
                )}
                {t(
                  missing.includes("Contact details")
                    ? "Which contact details can the team use? "
                    : "",
                )}
                {t("You can also correct any field above.")}
              </p>
              {followups.map((f, i) => (
                <div className="followup-message" key={i}>
                  {t(f)}
                </div>
              ))}
              <div className="followup-input">
                <input
                  aria-label={t("Follow-up information")}
                  value={followup}
                  onChange={(e) => setFollowup(e.target.value)}
                  placeholder={t("Add another detail in English or 中文…")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      followUp();
                    }
                  }}
                />
                <button
                  className="icon-button"
                  aria-label={t("Add follow-up details")}
                  disabled={!followup.trim()}
                  onClick={followUp}
                >
                  <Send size={17} />
                </button>
              </div>
            </div>
            <details className="original-message">
              <summary>{t("View original family message")}</summary>
              <p>{text}</p>
            </details>
            {error && (
              <p className="form-error" role="alert">
                {t(error)}
              </p>
            )}
          </div>
        )
      )}
      <div className="modal-footer">
        <button
          className="button secondary"
          onClick={step === 0 ? onClose : () => setStep(0)}
        >
          {step === 0 ? (
            t("Cancel")
          ) : (
            <>
              <ArrowLeft size={15} />
              {t("Back")}
            </>
          )}
        </button>
        <button
          className="button primary"
          onClick={step === 0 ? analyse : save}
        >
          {step === 0 ? (
            <>
              <Sparkles size={16} />
              {t("Organise enquiry")}
            </>
          ) : (
            <>
              <Check size={16} />
              {t(
                isPatient ? "Submit my care enquiry" : "Save & review enquiry",
              )}
            </>
          )}
        </button>
      </div>
    </ModalFrame>
  );
}
function DayPicker({
  days,
  onChange,
}: {
  days: string[];
  onChange: (days: string[]) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="day-picker">
      {WEEK_DAYS.map((day) => (
        <button
          type="button"
          key={day}
          aria-pressed={days.includes(day)}
          className={days.includes(day) ? "selected" : ""}
          onClick={() =>
            onChange(
              WEEK_DAYS.filter((d) =>
                d === day ? !days.includes(d) : days.includes(d),
              ),
            )
          }
        >
          {t(day)}
        </button>
      ))}
    </div>
  );
}

function CaseModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, locale } = useLocale();

  const { data, update, patchCase, toast, setModal } = useApp();
  const c = data.cases.find((c) => c.id === id)!;
  const [tab, setTab] = useState("Overview");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c);
  const [error, setError] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [availability, setAvailability] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  if (!c) return null;
  const missing = missingFields(c);
  const visits = data.visits.filter((v) => v.caseId === c.id);
  const assigned = data.providers.find((p) => p.id === c.providerId);
  const ready = canPublish(c);
  const alreadyPublished = [
    "Awaiting providers",
    "Provider confirmed",
    "Service active",
    "Completed",
  ].includes(c.status);
  function saveEdit() {
    if (!draft.name.trim()) {
      setError("Patient name or alias is required.");
      return;
    }
    patchCase(
      c.id,
      {
        name: draft.name,
        age: draft.age,
        district: draft.district,
        category: draft.category,
        care: draft.care,
        background: draft.background,
        time: draft.time,
        days: draft.days,
        duration: draft.duration,
        contact: draft.contact,
        budget: draft.budget,
        notes: draft.notes,
        clinicalReviewed: false,
        familyAgreed: false,
        priceConfirmed: false,
        approved: false,
        status: "Under review",
      },
      "Care request details updated; approvals reset",
    );
    setEditing(false);
    setError("");
    toast("Details saved. Review and family approval are required again.");
  }
  function publish() {
    if (!ready) {
      setError(
        "Complete the care details and all review checks before publishing.",
      );
      return;
    }
    update((next) => {
      const care = next.cases.find((i) => i.id === c.id)!;
      care.status = "Awaiting providers";
      care.updatedAt = new Date().toISOString();
      next.messages.unshift({
        id: uid(),
        caseId: c.id,
        content: broadcastText(c),
        createdAt: new Date().toISOString(),
        type: "Broadcast",
        status: "Simulated",
      });
      logEvent(
        next,
        "Case broadcast prepared",
        `${c.id} · Simulated provider message`,
        "message",
      );
    });
    setShowBroadcast(true);
    toast("Case published in the demo. email dispatch simulated.");
  }
  function apply() {
    const provider = data.providers.find((p) => p.id === selectedProvider);
    if (!provider || !availability) {
      setError("Select a provider and confirm availability for this case.");
      return;
    }
    if (!providerEligible(c, provider)) {
      setError(
        "This provider does not meet the current category, district, competency or consent requirements.",
      );
      return;
    }
    if (c.applications.some((a) => a.providerId === provider.id)) {
      setError("This provider has already applied.");
      return;
    }
    update((next) => {
      const care = next.cases.find((i) => i.id === c.id)!;
      care.applications.push({
        providerId: provider.id,
        appliedAt: new Date().toISOString(),
        available: true,
        status: "Pending",
      });
      logEvent(
        next,
        `${provider.name} applied for a case`,
        `${c.id} · Availability confirmed`,
        "provider",
      );
    });
    setSelectedProvider("");
    setAvailability(false);
    setError("");
    toast("Demo application recorded. Staff must confirm the assignment.");
  }
  function assign(providerId: string) {
    const provider = data.providers.find((p) => p.id === providerId)!;
    const application = c.applications.find((a) => a.providerId === providerId);
    if (!providerEligible(c, provider) || !application?.available) {
      setError(
        "Eligibility and availability checks must pass before assignment.",
      );
      return;
    }
    const candidateVisits = visits
      .filter((v) => v.status !== "Completed")
      .map((v) => ({ ...v, providerId }));
    if (
      candidateVisits.some((v) =>
        scheduleConflict(
          v,
          data.visits.filter((other) => other.caseId !== c.id),
        ),
      )
    ) {
      setError(
        "This provider has a conflicting visit. Please review the schedule before assignment.",
      );
      return;
    }
    update((next) => {
      const care = next.cases.find((i) => i.id === c.id)!;
      care.providerId = providerId;
      care.status = "Provider confirmed";
      care.applications.forEach(
        (a) =>
          (a.status =
            a.providerId === providerId ? "Assigned" : "Not selected"),
      );
      next.visits
        .filter((v) => v.caseId === c.id && v.status !== "Completed")
        .forEach((v) => {
          v.providerId = providerId;
          if (v.status === "Confirmed") v.reminder = "Scheduled";
        });
      care.updatedAt = new Date().toISOString();
      logEvent(
        next,
        "Provider assignment confirmed",
        `${provider.name} · ${c.id}`,
        "provider",
      );
    });
    setError("");
    toast(`${provider.name} assigned after staff review.`);
  }
  async function copyBroadcast() {
    try {
      await navigator.clipboard.writeText(broadcastText(c));
      toast("Privacy-conscious case message copied.");
    } catch {
      toast("Select the preview text to copy it.");
    }
  }
  return (
    <ModalFrame
      title={t(c.name)}
      eyebrow={t(`CARE REQUEST · ${c.id}`)}
      onClose={onClose}
      wide
    >
      <div className="case-meta-bar">
        <CaseBadge status={c.status} />
        <span>
          <MapPin size={14} />
          {t(c.district || "District to confirm")}
        </span>
        <span>
          <UserRound size={14} />
          {t(c.age ? `${c.age} years old` : "Age not provided")}
        </span>
        <span className="case-client-link">{t(c.clientId)}</span>
      </div>
      <div className="modal-tabs">
        {["Overview", "Schedule", "Provider applications", "History"].map(
          (tabName) => (
            <button
              key={tabName}
              onClick={() => {
                setTab(tabName);
                setError("");
              }}
              className={tab === tabName ? "active" : ""}
            >
              {t(tabName)}
              {tabName === "Provider applications" &&
                c.applications.length > 0 && (
                  <span>{c.applications.length}</span>
                )}
            </button>
          ),
        )}
      </div>
      <div className="modal-body">
        {tab === "Overview" && (
          <>
            <div className="case-section-heading">
              <h3>{t("Care request details")}</h3>
              {!alreadyPublished && (
                <button
                  className="text-button"
                  onClick={() => {
                    setDraft(c);
                    setEditing(!editing);
                  }}
                >
                  <Pencil size={13} />
                  {t(editing ? "Cancel editing" : "Edit details")}
                </button>
              )}
            </div>
            {editing ? (
              <>
                <div className="form-grid">
                  {(
                    [
                      { key: "name", label: "Patient name" },
                      { key: "age", label: "Age" },
                      { key: "care", label: "Care requirements" },
                      { key: "background", label: "Medical background" },
                      { key: "time", label: "Preferred time" },
                      { key: "duration", label: "Service duration" },
                      { key: "contact", label: "Contact details" },
                      {
                        key: "budget",
                        label: "Confirmed price / remuneration",
                      },
                    ] as const
                  ).map((f) => (
                    <Field key={f.key} label={t(f.label)}>
                      <input
                        value={draft[f.key]}
                        onChange={(e) =>
                          setDraft({ ...draft, [f.key]: e.target.value })
                        }
                      />
                    </Field>
                  ))}
                  <Field label={t("District")}>
                    <Select
                      label={t("Edit case district")}
                      value={draft.district}
                      onChange={(district) => setDraft({ ...draft, district })}
                      options={[
                        { value: "", label: "To be confirmed" },
                        ...DISTRICTS,
                      ]}
                    />
                  </Field>
                  <Field label={t("Provider category")}>
                    <Select
                      label={t("Edit provider category")}
                      value={draft.category}
                      onChange={(v) =>
                        setDraft({ ...draft, category: v as Category })
                      }
                      options={CATEGORIES}
                    />
                  </Field>
                </div>
                <Field label={t("Service days")}>
                  <DayPicker
                    days={draft.days}
                    onChange={(days) => setDraft({ ...draft, days })}
                  />
                </Field>
                <Field
                  label={t(
                    "Special requirements / approved instruction reference",
                  )}
                >
                  <textarea
                    rows={2}
                    value={draft.notes}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                    placeholder={t(
                      "Record relevant requirements without inventing clinical instructions.",
                    )}
                  />
                </Field>
                <div className="info-callout small">
                  <ShieldCheck size={17} />
                  <p>
                    {t(
                      "Editing details resets the review checks. Confirm the revised requirements with the family before publishing.",
                    )}
                  </p>
                </div>
                <button className="button primary" onClick={saveEdit}>
                  <Check size={15} />
                  {t("Save corrections")}
                </button>
              </>
            ) : (
              <>
                <div className="detail-grid">
                  <Detail label={t("Care requirements")} value={c.care} />
                  <Detail
                    label={t("Professional requirement")}
                    value={c.category}
                  />
                  <Detail
                    label={t("Medical background")}
                    value={c.background}
                  />
                  <Detail label={t("Service days")} value={c.days.join(", ")} />
                  <Detail label={t("Preferred time")} value={c.time} />
                  <Detail label={t("Service duration")} value={c.duration} />
                  <Detail label={t("Contact details")} value={c.contact} />
                  <Detail label={t("Price / remuneration")} value={c.budget} />
                </div>
                {c.quoteTotal !== undefined && (
                  <div className="info-callout quote-preview">
                    <ShieldCheck size={17} />
                    <p>
                      <strong>
                        {t("Quotation")}: HK${c.quoteTotal.toLocaleString()}
                      </strong>
                      <br />
                      <small>
                        {t(
                          "Materials and tools are supplied by the client. Remote travel allowance is paid by the platform, not added to your quote.",
                        )}
                      </small>
                    </p>
                  </div>
                )}
                {c.notes && (
                  <div className="case-notes">
                    <strong>
                      {t("Special requirements / instruction reference")}
                    </strong>
                    <p>{c.notes}</p>
                  </div>
                )}
                <div className="readable-summary">
                  <Sparkles size={17} />
                  <div>
                    <strong>{t("Care request summary")}</strong>
                    <p>
                      {t(c.age ? `A ${c.age}-year-old patient` : "The patient")}
                      {t(c.district ? ` in ${c.district}` : "")}{" "}
                      {t("is requesting")}
                      {t(" ")}
                      {t(
                        c.care ? c.care.toLowerCase() : "care to be confirmed",
                      )}
                      .
                      {t(
                        c.days.length
                          ? ` Preferred visits: ${c.days.join(", ")}.`
                          : "",
                      )}
                      {t(c.time ? ` Time: ${c.time}.` : "")}
                      {t(" ")}
                      {t(
                        c.duration
                          ? `Service duration: ${c.duration}.`
                          : "Service duration remains to be confirmed.",
                      )}
                      {t(" ")}
                      {t(
                        c.category === "Needs review"
                          ? "Professional requirements need staff review."
                          : "",
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}
            {!editing && missing.length > 0 && (
              <div className="missing-strip">
                <AlertCircle size={16} />
                <span>
                  {t("To clarify:")} {t(missing.join(" · "))}
                </span>
              </div>
            )}
            <details className="original-message">
              <summary>
                <MessageCircle size={14} />
                {t("Original family enquiry")}
              </summary>
              <p>{c.original}</p>
            </details>
            {!alreadyPublished && !editing && (
              <section className="approval-checklist">
                <h3>
                  <ShieldCheck size={18} />
                  {t("A human check at every important step.")}
                </h3>
                <p>
                  {t(
                    "Confirm the details below before preparing a provider broadcast.",
                  )}
                </p>
                {(
                  [
                    {
                      key: "clinicalReviewed",
                      label:
                        "Professional scope and care requirements reviewed by qualified staff",
                    },
                    {
                      key: "familyAgreed",
                      label:
                        "Family has agreed to the service and relevant details",
                    },
                    {
                      key: "priceConfirmed",
                      label: "Price and provider remuneration confirmed",
                    },
                    {
                      key: "approved",
                      label: "Company approval to publish this case",
                    },
                  ] as const
                ).map((check) => (
                  <label className="checkbox-row" key={check.key}>
                    <input
                      type="checkbox"
                      checked={c[check.key]}
                      onChange={(e) =>
                        patchCase(
                          c.id,
                          { [check.key]: e.target.checked },
                          `${check.label}: ${e.target.checked ? "confirmed" : "reopened"}`,
                        )
                      }
                    />
                    <span>{t(check.label)}</span>
                  </label>
                ))}
                {c.category === "Needs review" && (
                  <div className="form-hint">
                    {t(
                      "Use Edit details to confirm the required provider category after professional review.",
                    )}
                  </div>
                )}
              </section>
            )}
            {(alreadyPublished || showBroadcast) && (
              <details className="broadcast-preview" open={showBroadcast}>
                <summary>
                  <Send size={15} />
                  {t("Provider broadcast · privacy preview")}
                </summary>
                <pre>{t(broadcastText(c))}</pre>
                <button className="text-button" onClick={copyBroadcast}>
                  <Copy size={14} />
                  {t("Copy message")}
                </button>
                <Badge tone="amber" dot={false}>
                  {t("Simulated · no Email delivery")}
                </Badge>
              </details>
            )}
          </>
        )}
        {tab === "Schedule" && (
          <>
            <div className="case-section-heading">
              <div>
                <h3>{t("The care plan, at a glance.")}</h3>
                <p>
                  {t(
                    "Proposed visits are distinct from family-approved visits.",
                  )}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => setModal({ type: "schedule", caseId: c.id })}
              >
                <Plus size={15} />
                {t("Propose visits")}
              </button>
            </div>
            {visits.length ? (
              <div className="case-visits">
                {visits.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setModal({ type: "visit", id: v.id })}
                  >
                    <span className="visit-date-block">
                      <strong>{t(localDate(v.date).getDate())}</strong>
                      <small>
                        {t(
                          localDate(v.date).toLocaleDateString(locale, {
                            month: "short",
                          }),
                        )}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {t(v.time)} · {t(v.tasks)}
                      </strong>
                      <small>
                        {v.duration} {t("min · Version")} {t(v.version)}
                        {t(
                          v.previousTime
                            ? ` · Revised from ${v.previousTime}`
                            : "",
                        )}
                      </small>
                    </span>
                    <Badge
                      tone={
                        v.status === "Proposed"
                          ? "amber"
                          : v.status === "Completed"
                            ? "blue"
                            : "green"
                      }
                    >
                      {t(v.status)}
                    </Badge>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t("A little planning goes a long way")}
                description={t(
                  "Create a proposed schedule using confirmed requirements and let the family review it.",
                )}
              />
            )}
            <div className="inline-note">
              <ShieldCheck size={16} />
              <p>
                {t(
                  "Tasks and clinical frequencies must come from confirmed instructions. This tool only organises them.",
                )}
              </p>
            </div>
          </>
        )}
        {tab === "Provider applications" && (
          <>
            <div className="case-section-heading">
              <div>
                <h3>
                  {t(
                    assigned
                      ? "A helping hand, confirmed."
                      : "Find the right helping hand.",
                  )}
                </h3>
                <p>
                  {t(
                    "Providers apply voluntarily. Your team makes the final assignment.",
                  )}
                </p>
              </div>
            </div>
            {assigned && (
              <div className="assigned-provider">
                <Avatar name={assigned.name} color={assigned.color} />
                <span>
                  <strong>{assigned.name}</strong>
                  <small>{t(assigned.category)}</small>
                </span>
                <Badge tone="green">{t("Assigned")}</Badge>
              </div>
            )}
            {c.applications.length > 0 && (
              <div className="application-list">
                {c.applications.map((a) => {
                  const p = data.providers.find((p) => p.id === a.providerId)!;
                  const eligible = providerEligible(c, p);
                  return (
                    <div key={p.id}>
                      <Avatar name={p.name} color={p.color} />
                      <span className="application-person">
                        <strong>{p.name}</strong>
                        <small>
                          {t(p.category)} · {t(p.experience)}{" "}
                          {t("years experience")}
                        </small>
                        <span>
                          {eligible ? (
                            <>
                              <ShieldCheck size={12} />
                              {t("Eligibility checks passed")}
                            </>
                          ) : (
                            <>
                              <AlertCircle size={12} />
                              {t("Eligibility review required")}
                            </>
                          )}
                        </span>
                      </span>
                      {a.status === "Assigned" ? (
                        <Badge tone="green">{t("Assigned")}</Badge>
                      ) : c.providerId ? (
                        <Badge dot={false}>{t(a.status)}</Badge>
                      ) : (
                        <button
                          className="button secondary"
                          disabled={!eligible}
                          onClick={() => assign(p.id)}
                        >
                          {t("Confirm assignment")} <Check size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!c.applications.length && (
              <EmptyState
                title={t("No applications just yet")}
                description={t(
                  alreadyPublished
                    ? "Providers can review the opportunity and confirm their availability."
                    : "Publish this request after review to open provider applications.",
                )}
              />
            )}
            {c.status === "Awaiting providers" && (
              <div className="demo-application">
                <Badge tone="amber" dot={false}>
                  {t("SIMULATE A PROVIDER APPLICATION")}
                </Badge>
                <h4>{t("Try the voluntary application flow")}</h4>
                <Field label={t("Provider")}>
                  <Select
                    label={t("Applying provider")}
                    value={selectedProvider}
                    onChange={(v) => {
                      setSelectedProvider(v);
                      setError("");
                    }}
                    options={[
                      { value: "", label: "Select a provider" },
                      ...data.providers
                        .filter(
                          (p) =>
                            !c.applications.some((a) => a.providerId === p.id),
                        )
                        .map((p) => ({
                          value: p.id,
                          label: `${p.name} · ${p.category}${providerEligible(c, p) ? " · Eligible" : " · Requirements not met"}`,
                        })),
                    ]}
                  />
                </Field>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={availability}
                    onChange={(e) => setAvailability(e.target.checked)}
                  />
                  <span>
                    {t(
                      "I confirm this provider has indicated availability for the requested visits.",
                    )}
                  </span>
                </label>
                <button className="button primary" onClick={apply}>
                  {t("Submit demo application")} <ArrowRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
        {tab === "History" && (
          <div className="case-history">
            <div className="history-entry">
              <span className="activity-icon case">
                <Plus size={15} />
              </span>
              <div>
                <strong>{t("Enquiry created")}</strong>
                <p>
                  {t(
                    new Date(c.createdAt).toLocaleString(locale, {
                      timeZone: "Asia/Hong_Kong",
                    }),
                  )}
                </p>
              </div>
            </div>
            {data.activities
              .filter(
                (a) => a.detail.includes(c.id) || a.detail.includes(c.name),
              )
              .map((a) => (
                <div className="history-entry" key={a.id}>
                  <span className={`activity-icon ${a.kind}`}>
                    <Check size={15} />
                  </span>
                  <div>
                    <strong>{t(a.text)}</strong>
                    <p>{t(a.detail)}</p>
                    <small>
                      {t(
                        new Date(a.time).toLocaleString(locale, {
                          timeZone: "Asia/Hong_Kong",
                        }),
                      )}
                    </small>
                  </div>
                </div>
              ))}
            <div className="history-entry">
              <span className="activity-icon schedule">
                <Clock3 size={15} />
              </span>
              <div>
                <strong>{t("Last updated")}</strong>
                <p>
                  {t(
                    new Date(c.updatedAt).toLocaleString(locale, {
                      timeZone: "Asia/Hong_Kong",
                    }),
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            <AlertCircle size={17} />
            {t(error)}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <span className="modal-footer-note">
          <ShieldCheck size={14} />
          {t("Private care-team record")}
        </span>
        {tab === "Overview" && !alreadyPublished && !editing ? (
          <button
            className="button primary"
            disabled={!ready}
            onClick={publish}
          >
            {t("確認並發布 Case")} <Send size={15} />
          </button>
        ) : (
          <button className="button secondary" onClick={onClose}>
            {t("Done")}
          </button>
        )}
      </div>
    </ModalFrame>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  const { t } = useLocale();

  return (
    <div className="detail">
      <span>{t(label)}</span>
      <strong className={!value ? "unknown" : ""}>
        {t(value || "Not yet confirmed")}
      </strong>
    </div>
  );
}

function ScheduleModal({
  caseId,
  onClose,
}: {
  caseId?: string;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();

  const { data, update, toast, setModal } = useApp();
  const [selected, setSelected] = useState(caseId || "");
  const c = data.cases.find((c) => c.id === selected);
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [days, setDays] = useState<string[]>(c?.days || []);
  const [tasks, setTasks] = useState(c?.care || "");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Visit[]>([]);
  function changeCase(id: string) {
    setSelected(id);
    const care = data.cases.find((c) => c.id === id);
    setDays(care?.days || []);
    setTasks(care?.care || "");
    setPreview([]);
    setConfirmed(false);
  }
  function generate() {
    if (
      !c ||
      !start ||
      !end ||
      !time ||
      !duration ||
      !days.length ||
      !tasks.trim()
    ) {
      setError(
        "Choose a client, date range, start time, visit length, days and confirmed tasks.",
      );
      return;
    }
    if (!confirmed) {
      setError(
        "Please confirm these tasks and their frequency come from approved requirements.",
      );
      return;
    }
    if (!c.clinicalReviewed) {
      setError(
        "The care request needs professional review before a schedule can be proposed.",
      );
      return;
    }
    if (start > end) {
      setError("The end date must be on or after the start date.");
      return;
    }
    const dayCount =
      Math.round(
        (localDate(end).getTime() - localDate(start).getTime()) / 86400000,
      ) + 1;
    if (dayCount > 31) {
      setError("For this prototype, propose up to 31 days at a time.");
      return;
    }
    const minute = Number(time.split(":")[0]) * 60 + Number(time.split(":")[1]);
    if (minute < 480 || minute + Number(duration) > 1080) {
      setError(
        "Choose a visit between 08:00 and 18:00 so it can be shown in the prototype calendar.",
      );
      return;
    }
    const result: Visit[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = localDate(start);
      d.setDate(d.getDate() + i);
      if (!days.includes(WEEK_DAYS[(d.getDay() + 6) % 7])) continue;
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      result.push({
        id: uid(),
        caseId: c.id,
        date,
        time,
        duration: Number(duration),
        tasks: tasks.trim(),
        providerId: c.providerId,
        status: "Proposed",
        version: 1,
        instructionsConfirmed: true,
        reminder: "Not scheduled",
      });
    }
    if (!result.length) {
      setError("None of the selected weekdays fall in that date range.");
      return;
    }
    if (result.some((v) => scheduleConflict(v, data.visits))) {
      setError(
        "A client or assigned provider has an overlapping visit. Please choose another time or date range.",
      );
      return;
    }
    setError("");
    setPreview(result);
  }
  function save() {
    if (!preview.length || !c) return;
    if (preview.some((v) => scheduleConflict(v, data.visits))) {
      setPreview([]);
      setError("The schedule changed. Please check conflicts again.");
      return;
    }
    update((next) => {
      next.visits.push(...preview);
      const care = next.cases.find((i) => i.id === c.id)!;
      care.updatedAt = new Date().toISOString();
      logEvent(
        next,
        "Proposed care schedule created",
        `${c.id} · ${preview.length} visits awaiting family approval`,
        "schedule",
      );
    });
    toast(`${preview.length} proposed visits saved for family review.`);
    setModal({ type: "case", id: c.id });
  }
  return (
    <ModalFrame
      title={t("A little structure. A lot of reassurance.")}
      eyebrow={t("PROPOSE A CARE SCHEDULE")}
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <div className="info-callout small">
          <ShieldCheck size={20} />
          <p>
            {t(
              "Arrange tasks from confirmed requirements. This planner does not choose clinical tasks, treatment frequency or medication instructions.",
            )}
          </p>
        </div>
        {!preview.length ? (
          <>
            <div className="form-grid">
              <Field label={t("Client / care request")} required>
                <Select
                  label={t("Schedule client")}
                  value={selected}
                  onChange={changeCase}
                  options={[
                    { value: "", label: "Select a care request" },
                    ...data.cases
                      .filter((c) => c.status !== "Completed")
                      .map((c) => ({
                        value: c.id,
                        label: `${c.name} · ${c.id}`,
                      })),
                  ]}
                />
              </Field>
              <Field label={t("Confirmed tasks")} required>
                <input
                  value={tasks}
                  onChange={(e) => setTasks(e.target.value)}
                  placeholder={t("As confirmed in the care request")}
                />
              </Field>
              <Field label={t("First service date")} required>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label={t("Last service date")} required>
                <input
                  type="date"
                  min={start}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
              <Field label={t("Visit start time (HKT)")} required>
                <input
                  type="time"
                  min="08:00"
                  max="17:45"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </Field>
              <Field label={t("Visit length")} required>
                <Select
                  label={t("Visit duration")}
                  value={duration}
                  onChange={setDuration}
                  options={[
                    { value: "", label: "Confirm visit length" },
                    { value: "30", label: "30 minutes" },
                    { value: "45", label: "45 minutes" },
                    { value: "60", label: "1 hour" },
                    { value: "90", label: "1.5 hours" },
                    { value: "120", label: "2 hours" },
                  ]}
                />
              </Field>
            </div>
            <Field label={t("Confirmed service days")} required>
              <DayPicker days={days} onChange={setDays} />
            </Field>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                {t(
                  "These tasks, service days and frequency are based on confirmed family requirements and, for clinical care, authorised professional instructions.",
                )}
              </span>
            </label>
          </>
        ) : (
          <>
            <div className="preview-heading">
              <div>
                <h3>
                  {c?.name} {t("· Proposed care schedule")}
                </h3>
                <p>
                  {preview.length} {t("visits ·")} {t(shortDate(start, locale))}{" "}
                  –{t(" ")}
                  {t(shortDate(end, locale))}{" "}
                  {t("· Subject to family approval")}
                </p>
              </div>
              <Badge tone="amber">{t("Proposed")}</Badge>
            </div>
            <div className="table-scroll">
              <table className="care-table">
                <thead>
                  <tr>
                    <th>{t("DAY / DATE")}</th>
                    <th>{t("TIME")}</th>
                    <th>{t("CONFIRMED TASKS")}</th>
                    <th>{t("STATUS")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((v) => (
                    <tr key={v.id}>
                      <td>
                        {t(
                          localDate(v.date).toLocaleDateString(locale, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          }),
                        )}
                      </td>
                      <td>
                        {t(v.time)} · {v.duration} {t("min")}
                      </td>
                      <td>{t(v.tasks)}</td>
                      <td>
                        <Badge tone="amber">{t("Pending approval")}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="schedule-preview-note">
              <CheckCheck size={19} />
              <div>
                <strong>{t("No conflicts found.")}</strong>
                <p>
                  {t(
                    "Checked against existing visits for the client and any assigned provider. Provider availability still needs explicit confirmation.",
                  )}
                </p>
              </div>
            </div>
          </>
        )}
        {error && (
          <div className="error-box" role="alert">
            <AlertCircle size={17} />
            {t(error)}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button
          className="button secondary"
          onClick={preview.length ? () => setPreview([]) : onClose}
        >
          {preview.length ? (
            <>
              <ArrowLeft size={15} />
              {t("Edit proposal")}
            </>
          ) : (
            "Cancel"
          )}
        </button>
        <button
          className="button primary"
          onClick={preview.length ? save : generate}
        >
          {preview.length ? (
            <>
              <Check size={16} />
              {t("Save proposed schedule")}
            </>
          ) : (
            <>
              <CalendarDays size={16} />
              {t("Generate proposal")}
            </>
          )}
        </button>
      </div>
    </ModalFrame>
  );
}

function VisitModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, locale } = useLocale();

  const { data, update, toast } = useApp();
  const visit = data.visits.find((v) => v.id === id)!;
  const c = data.cases.find((c) => c.id === visit?.caseId)!;
  const p = data.providers.find((p) => p.id === visit?.providerId);
  const [revising, setRevising] = useState(false);
  const [newDate, setNewDate] = useState(visit?.date || today());
  const [newTime, setNewTime] = useState(visit?.time || "");
  const [familyConfirmed, setFamilyConfirmed] = useState(false);
  const [providerConfirmed, setProviderConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [issue, setIssue] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  if (!visit || !c) return null;
  function approve() {
    if (!familyConfirmed) {
      setError("Record the family’s approval before confirming the visit.");
      return;
    }
    if (visit.changeRequest) {
      setError(
        "Review the patient's change request and prepare a revised proposal before recording approval.",
      );
      return;
    }
    if (!c.clinicalReviewed || !visit.instructionsConfirmed) {
      setError("The care requirements need professional confirmation first.");
      return;
    }
    if (scheduleConflict(visit, data.visits, visit.id)) {
      setError(
        "There is a scheduling conflict. Revise the visit before approval.",
      );
      return;
    }
    update((next) => {
      const v = next.visits.find((v) => v.id === id)!;
      v.status = "Confirmed";
      v.reminder = v.providerId ? "Scheduled" : "Not scheduled";
      next.cases.find((item) => item.id === c.id)!.updatedAt =
        new Date().toISOString();
      logEvent(
        next,
        "Family approved the care schedule",
        `${c.id} · ${visit.date} at ${visit.time}`,
        "schedule",
      );
    });
    setFamilyConfirmed(false);
    setError("");
    toast("Visit confirmed. The approved version has been saved.");
  }
  function revise() {
    if (!newDate || !newTime) {
      setError("Choose the revised date and time.");
      return;
    }
    if (newDate === visit.date && newTime === visit.time) {
      setError("Choose a different time or date to request a revision.");
      return;
    }
    const minute =
      Number(newTime.split(":")[0]) * 60 + Number(newTime.split(":")[1]);
    if (minute < 480 || minute + visit.duration > 1080) {
      setError("Please choose a visit between 08:00 and 18:00.");
      return;
    }
    const candidate = { ...visit, date: newDate, time: newTime };
    if (scheduleConflict(candidate, data.visits, id)) {
      setError(
        "This change overlaps another visit for the client or assigned provider. Please choose another time.",
      );
      return;
    }
    update((next) => {
      const v = next.visits.find((v) => v.id === id)!;
      v.previousTime = `${v.date} ${v.time}`;
      v.date = newDate;
      v.time = newTime;
      v.status = "Proposed";
      v.reminder = "Not scheduled";
      delete v.changeRequest;
      v.version += 1;
      next.cases.find((item) => item.id === c.id)!.updatedAt =
        new Date().toISOString();
      logEvent(
        next,
        "Schedule change requested",
        `${c.id} · ${visit.time} → ${newTime} · Reapproval needed`,
        "schedule",
      );
    });
    setRevising(false);
    setFamilyConfirmed(false);
    setError("");
    toast("Revision saved. Family reapproval is required.");
  }
  function remind() {
    if (
      visit.status !== "Confirmed" ||
      !p ||
      !["Provider confirmed", "Service active"].includes(c.status)
    ) {
      setError(
        "A confirmed visit and a staff-confirmed provider assignment are required.",
      );
      return;
    }
    if (visit.reminder === "Simulated delivery") {
      toast("A reminder was already simulated for this visit.");
      return;
    }
    update((next) => {
      next.visits.find((v) => v.id === id)!.reminder = "Simulated delivery";
      next.messages.unshift({
        id: uid(),
        caseId: c.id,
        type: "Reminder",
        status: "Simulated",
        createdAt: new Date().toISOString(),
        content: `VISIT REMINDER · ${c.id}\n\nTo: ${p.name}\nYour confirmed visit is scheduled for ${visit.date} at ${visit.time} HKT.\nTask: ${visit.tasks}\nPlease review the authorised care instructions before the visit.\n\n[Confirm completion] [Report an issue]\n\nThis is a simulated reminder. Delivery does not confirm care completion.`,
      });
      logEvent(
        next,
        "Visit reminder simulated",
        `${c.id} · ${p.name} · No real message sent`,
        "message",
      );
    });
    setError("");
    toast("Reminder simulated. Visit is still awaiting provider confirmation.");
  }
  function complete() {
    if (!providerConfirmed) {
      setError(
        "Completion requires an explicit confirmation from the assigned provider.",
      );
      return;
    }
    if (!p || visit.status !== "Confirmed") {
      setError("A confirmed visit and assigned provider are required.");
      return;
    }
    update((next) => {
      const v = next.visits.find((v) => v.id === id)!;
      v.status = "Completed";
      v.completedAt = new Date().toISOString();
      const care = next.cases.find((item) => item.id === c.id)!;
      care.updatedAt = new Date().toISOString();
      const remaining = next.visits.filter(
        (item) => item.caseId === c.id && item.status !== "Completed",
      );
      care.status = remaining.length ? "Service active" : "Completed";
      logEvent(
        next,
        "Provider confirmed visit completion",
        `${c.id} · ${p.name} · ${visit.date} ${visit.time}`,
        "schedule",
      );
    });
    setError("");
    toast("Provider confirmation recorded. Client record updated.");
  }
  function reportIssue() {
    if (!issue.trim()) {
      setError("Add a short description so the team can follow up.");
      return;
    }
    update((next) => {
      const affectedVisit = next.visits.find((v) => v.id === id)!;
      affectedVisit.status = "Issue reported";
      affectedVisit.reminder = "Not scheduled";
      next.cases.find((item) => item.id === c.id)!.updatedAt =
        new Date().toISOString();
      logEvent(
        next,
        "Staff attention needed: visit issue",
        `${c.id} · ${issue.trim()}`,
        "schedule",
      );
    });
    setShowIssue(false);
    toast("Issue logged for staff follow-up in the demo activity feed.");
  }
  return (
    <ModalFrame
      title={t(`${c.name} · Care visit`)}
      eyebrow={t(`${c.id} · SCHEDULE VERSION ${visit.version}`)}
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="visit-modal-status">
          <Badge
            tone={
              visit.status === "Proposed"
                ? "amber"
                : visit.status === "Completed"
                  ? "blue"
                  : visit.status === "Issue reported"
                    ? "red"
                    : "green"
            }
          >
            {t(visit.status)}
          </Badge>
          <span>
            {t(visit.date)} {t("· HKT")}
          </span>
        </div>
        <div className="visit-details-main">
          <span className="large-calendar-icon">
            <CalendarDays size={29} />
          </span>
          <div>
            <h3>
              {t(
                localDate(visit.date).toLocaleDateString(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }),
              )}
            </h3>
            <p>
              {t(visit.time)} · {visit.duration} {t("minutes")}
            </p>
          </div>
        </div>
        <div className="detail-grid">
          <Detail label={t("Confirmed task(s)")} value={visit.tasks} />
          <Detail label={t("Service district")} value={c.district} />
          <Detail label={t("Assigned provider")} value={p?.name || ""} />
          <Detail label={t("Reminder status")} value={visit.reminder} />
        </div>
        {visit.previousTime && (
          <div className="revision-diff">
            <Pencil size={15} />
            <span>
              {t("Changed from")} <s>{t(visit.previousTime)}</s> {t("to")}
              {t(" ")}
              <strong>
                {t(visit.date)} {t(visit.time)}
              </strong>
              .{t(" ")}
              {t(
                visit.status === "Proposed"
                  ? "Family reapproval required."
                  : "Revised version approved.",
              )}
            </span>
          </div>
        )}
        {visit.changeRequest && (
          <div className="patient-pending-change">
            <MessageCircle size={18} />
            <div>
              <strong>{t("Patient requested another time")}</strong>
              <p>
                {t(visit.changeRequest.date)} {t("at")}{" "}
                {t(visit.changeRequest.time)} {t("HKT")}
              </p>
              {visit.changeRequest.note && <p>{visit.changeRequest.note}</p>}
              <small>
                {t(
                  "Check provider availability before preparing the revised proposal. Family reapproval is required.",
                )}
              </small>
              <button
                className="button secondary"
                onClick={() => {
                  setNewDate(visit.changeRequest!.date);
                  setNewTime(visit.changeRequest!.time);
                  setRevising(true);
                  setError("");
                }}
              >
                {t("Prepare revised proposal")} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
        {visit.status === "Completed" && (
          <div className="success-box">
            <CheckCheck size={19} />
            <div>
              <strong>{t("Completion confirmed by the provider.")}</strong>
              <p>
                {t(
                  visit.completedAt
                    ? new Date(visit.completedAt).toLocaleString(locale, {
                        timeZone: "Asia/Hong_Kong",
                      })
                    : "Completion recorded in this prototype",
                )}
              </p>
            </div>
          </div>
        )}
        {revising ? (
          <div className="revision-form">
            <h3>{t("A better time for the family?")}</h3>
            <div className="form-grid">
              <Field label={t("Revised date")}>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </Field>
              <Field label={t("Revised start time (HKT)")}>
                <input
                  type="time"
                  min="08:00"
                  max="17:45"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </Field>
            </div>
            <p className="form-hint">
              {t(
                "The change is checked for overlapping visits and saved as a new proposed version.",
              )}
            </p>
            <button className="button primary" onClick={revise}>
              {t("Save revision")} <ArrowRight size={15} />
            </button>
            <button className="button ghost" onClick={() => setRevising(false)}>
              {t("Cancel")}
            </button>
          </div>
        ) : visit.status === "Proposed" ? (
          <div className="family-approval">
            <div>
              <ShieldCheck size={21} />
              <h3>{t("Ready for the family’s review.")}</h3>
            </div>
            <p>
              {t(
                "Check the date, time and confirmed care tasks together. Approval is for this schedule only.",
              )}
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={familyConfirmed}
                onChange={(e) => setFamilyConfirmed(e.target.checked)}
              />
              <span>
                {t(
                  "I’m recording the family’s approval of this proposed visit.",
                )}
              </span>
            </label>
            <div className="button-row">
              <button className="button primary" onClick={approve}>
                <Check size={15} />
                {t("Approve schedule")}
              </button>
              <button
                className="button secondary"
                onClick={() => setRevising(true)}
              >
                <Pencil size={14} />
                {t("Request a change")}
              </button>
            </div>
          </div>
        ) : visit.status === "Confirmed" ? (
          <>
            <div className="visit-operations">
              <h3>
                <BellIcon />
                {t("Provider coordination · simulation")}
              </h3>
              <p>
                {t(
                  "Use the demo controls to preview a reminder and record an explicit provider response.",
                )}
              </p>
              <button
                className="button secondary"
                onClick={remind}
                disabled={visit.reminder === "Simulated delivery"}
              >
                <MessageCircle size={15} />
                {t(
                  visit.reminder === "Simulated delivery"
                    ? "Reminder simulated"
                    : "Simulate visit reminder",
                )}
              </button>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={providerConfirmed}
                  onChange={(e) => setProviderConfirmed(e.target.checked)}
                />
                <span>
                  {t(
                    "The assigned provider has explicitly confirmed that this visit is completed.",
                  )}
                </span>
              </label>
              <div className="button-row">
                <button
                  className="button primary"
                  onClick={complete}
                  disabled={!p}
                >
                  <CheckCheck size={15} />
                  {t("Record completion")}
                </button>
                <button
                  className="button secondary"
                  onClick={() => setShowIssue(!showIssue)}
                >
                  {t("Report an issue")}
                </button>
                <button
                  className="button ghost"
                  onClick={() => setRevising(true)}
                >
                  {t("Revise")}
                </button>
              </div>
              {!p && (
                <p className="form-hint">
                  {t(
                    "Assign a verified provider from the care request before recording completion.",
                  )}
                </p>
              )}
            </div>
            {showIssue && (
              <div className="issue-form">
                <Field label={t("What needs attention?")}>
                  <textarea
                    rows={2}
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                    placeholder={t("Unable to attend, needs assistance…")}
                  />
                </Field>
                <button className="button primary" onClick={reportIssue}>
                  {t("Log issue for staff")}
                </button>
              </div>
            )}
          </>
        ) : visit.status === "Issue reported" ? (
          <div className="error-box">
            <AlertCircle size={19} />
            <p>
              {t(
                "Staff follow-up required. Review the activity log and contact the provider.",
              )}
              {t(" ")}
              <button className="text-button" onClick={() => setRevising(true)}>
                {t("Propose a revised visit")}
              </button>
            </p>
          </div>
        ) : null}
        {error && (
          <div className="error-box" role="alert">
            <AlertCircle size={17} />
            {t(error)}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <span className="modal-footer-note">
          <ShieldCheck size={14} />
          {t("Care decisions stay with qualified people.")}
        </span>
        <button className="button secondary" onClick={onClose}>
          {t("Done")}
        </button>
      </div>
    </ModalFrame>
  );
}
function BellIcon() {
  return <Clock3 size={17} />;
}

function ProviderModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useLocale();

  const { data } = useApp();
  const p = data.providers.find((p) => p.id === id)!;
  if (!p) return null;
  return (
    <ModalFrame
      title={t(p.name)}
      eyebrow={t(`PROVIDER PROFILE · ${p.id}`)}
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="provider-profile-hero">
          <Avatar name={p.name} color={p.color} size="lg" />
          <div>
            <h3>{t(p.category)}</h3>
            <p>
              {t(p.experience)} {t("years of experience")}
            </p>
          </div>
          <Badge tone={p.verified ? "green" : "amber"}>
            {t(p.verified ? "Demo verified" : "Verification pending")}
          </Badge>
        </div>
        <div className="detail-grid">
          <Detail
            label={t("Registration / verification")}
            value={p.registration}
          />
          <Detail
            label={t("Availability")}
            value={p.available ? "Open to enquiries" : "Currently at capacity"}
          />
          <Detail
            label={t("Communication preference")}
            value={
              p.optIn
                ? "Opted in to case opportunities"
                : "No messaging consent"
            }
          />
          <Detail label={t("Professional category")} value={p.category} />
        </div>
        <div className="profile-section">
          <h3>
            <MapPin size={16} />
            {t("Service districts")}
          </h3>
          <div className="skill-tags">
            {p.districts.map((d) => (
              <span key={d}>{t(d)}</span>
            ))}
          </div>
        </div>
        <div className="profile-section">
          <h3>
            <HeartHandshake size={17} />
            {t("Competencies & approved categories")}
          </h3>
          <div className="skill-tags">
            {p.skills.map((s) => (
              <span key={s}>{t(s)}</span>
            ))}
          </div>
        </div>
        <div className="info-callout small">
          <ShieldCheck size={20} />
          <p>
            {t(
              "This is a fictional profile. Real registration details, identity checks, competency verification and explicit availability are required before any live assignment.",
            )}
          </p>
        </div>
      </div>
      <div className="modal-footer">
        <span className="modal-footer-note">
          {t("Sensitive registration details are never broadcast.")}
        </span>
        <button className="button secondary" onClick={onClose}>
          {t("Done")}
        </button>
      </div>
    </ModalFrame>
  );
}
function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();

  return (
    <ModalFrame
      title={t("Care, connected. One step at a time.")}
      eyebrow={t("WELCOME TO KINDRED CARE")}
      onClose={onClose}
    >
      <div className="modal-body">
        <p className="help-intro">
          {t(
            "An interactive frontend prototype for home nursing navigation and coordination in Hong Kong.",
          )}
        </p>
        <div className="help-steps">
          {[
            {
              icon: MessageCircle,
              title: "Start with an enquiry",
              text: "Enter a message in English or Traditional Chinese. Review extracted fields and keep unknown details unconfirmed.",
            },
            {
              icon: FileText,
              title: "Review the care request",
              text: "Correct details, confirm the professional category, and record family agreement, pricing and staff approval.",
            },
            {
              icon: CalendarDays,
              title: "Make a thoughtful schedule",
              text: "Propose visits from confirmed tasks. Families can approve or request a change, with revisions recorded.",
            },
            {
              icon: HeartHandshake,
              title: "Bring the right people together",
              text: "Preview a provider broadcast, simulate an application and confirm an eligible provider assignment.",
            },
          ].map((step, i) => (
            <div key={step.title}>
              <span>
                <step.icon size={19} />
              </span>
              <div>
                <strong>
                  {t(i + 1)}. {t(step.title)}
                </strong>
                <p>{t(step.text)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="info-callout small">
          <Sparkles size={20} />
          <p>
            <strong>{t("What’s simulated:")}</strong>{" "}
            {t(
              "AI extraction uses deterministic rules. Email delivery, credentials and staff roles are demonstrations. Browser storage, editing, approval, conflict checks and exports are functional.",
            )}
          </p>
        </div>
        <p className="form-hint">
          {t(
            "Use fictional data. This prototype is not monitored for emergencies. For an immediate emergency in Hong Kong, call 999.",
          )}
        </p>
      </div>
      <div className="modal-footer">
        <span className="modal-footer-note">
          {t("Built around people, supported by technology.")}
        </span>
        <button className="button primary" onClick={onClose}>
          {t("Let’s get started")} <ArrowRight size={15} />
        </button>
      </div>
    </ModalFrame>
  );
}
function ResetModal({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();

  const { update, toast } = useApp();
  return (
    <ModalFrame
      title={t("Start with a fresh demo?")}
      eyebrow={t("RESET WORKSPACE")}
      onClose={onClose}
    >
      <div className="modal-body">
        <p>
          {t(
            "This replaces your browser-saved care requests, schedules, applications and messages with the original fictional sample records.",
          )}
        </p>
        <p className="form-hint">
          {t("You can download a JSON backup from Settings before resetting.")}
        </p>
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          {t("Keep my changes")}
        </button>
        <button
          className="button danger"
          onClick={() => {
            const seed = createSeed();
            update((next) => Object.assign(next, seed));
            toast("Demo workspace reset.");
            onClose();
          }}
        >
          {t("Reset demo workspace")}
        </button>
      </div>
    </ModalFrame>
  );
}
