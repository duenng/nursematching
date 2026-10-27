import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MessageCircle,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { Badge, Field, ModalFrame, Select } from "./components";
import { logEvent, useApp } from "./store";
import { DISTRICTS, localDate, scheduleConflict, today } from "./lib/workflow";
import type { CareCase } from "./types";

export function PatientVisitModal({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, update, toast, patientClientId } = useApp();
  const visit = data.visits.find((v) => v.id === id);
  const c = data.cases.find(
    (c) => c.id === visit?.caseId && c.clientId === patientClientId,
  );
  const [approved, setApproved] = useState(false);
  const [changing, setChanging] = useState(false);
  const [date, setDate] = useState(visit?.date || today());
  const [time, setTime] = useState(visit?.time || "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  if (!visit || !c) return null;
  const provider = data.providers.find((p) => p.id === visit.providerId);
  function approve() {
    if (!visit || !c) return;
    if (!approved) {
      setError("Please confirm you’ve checked the date, time and care tasks.");
      return;
    }
    if (!c.clinicalReviewed || !visit.instructionsConfirmed) {
      setError(
        "The care team needs to finish reviewing the requirements before this visit can be approved.",
      );
      return;
    }
    if (visit.changeRequest) {
      setError(
        "Please wait for the care team to review your requested change before approving this visit.",
      );
      return;
    }
    if (scheduleConflict(visit, data.visits, id)) {
      setError(
        "This visit overlaps another visit. Please ask the care team to review it.",
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
        "Patient approved a proposed visit",
        `${c.id} · ${visit.date} at ${visit.time} · Version ${visit.version}`,
        "schedule",
      );
    });
    setError("");
    setApproved(false);
    toast("Your visit approval is saved in this demo.");
  }
  function requestChange() {
    if (!visit || !c) return;
    if (!date || !time) {
      setError("Choose the date and time you’d prefer.");
      return;
    }
    if (date === visit.date && time === visit.time) {
      setError("Please choose a different date or time.");
      return;
    }
    const minutes =
      Number(time.split(":")[0]) * 60 + Number(time.split(":")[1]);
    if (minutes < 480 || minutes + visit.duration > 1080) {
      setError(
        "Please choose a time between 08:00 and 18:00 for this prototype.",
      );
      return;
    }
    if (scheduleConflict({ ...visit, date, time }, data.visits, id)) {
      setError(
        "That time overlaps another scheduled visit. Please try a different time, or ask the care team for help.",
      );
      return;
    }
    update((next) => {
      next.visits.find((v) => v.id === id)!.changeRequest = {
        date,
        time,
        note: note.trim(),
        requestedAt: new Date().toISOString(),
      };
      next.cases.find((item) => item.id === c.id)!.updatedAt =
        new Date().toISOString();
      logEvent(
        next,
        "Patient requested a visit change",
        `${c.id} · ${visit.date} ${visit.time} → ${date} ${time}${note.trim() ? ` · ${note.trim()}` : ""} · Awaiting team review`,
        "schedule",
      );
    });
    setError("");
    setChanging(false);
    toast(
      "Your preferred time is saved for care-team review. The current visit has not changed.",
    );
  }
  return (
    <ModalFrame
      title="Your care visit"
      eyebrow={`${c.name} · ${c.id}`}
      onClose={onClose}
    >
      <div className="modal-body patient-modal-body">
        <div className="patient-dialog-status">
          <Badge
            tone={
              visit.status === "Proposed"
                ? "amber"
                : visit.status === "Completed"
                  ? "blue"
                  : "green"
            }
          >
            {visit.status === "Proposed"
              ? "Proposed · for your approval"
              : visit.status}
          </Badge>
          <span>Version {visit.version}</span>
        </div>
        <div className="patient-dialog-date">
          <CalendarDays size={32} />
          <div>
            <h3>
              {localDate(visit.date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
            <p>
              <Clock3 size={14} />
              {visit.time} · {visit.duration} minutes · HKT
            </p>
          </div>
        </div>
        <dl className="patient-dialog-details">
          <div>
            <dt>Care tasks</dt>
            <dd>{visit.tasks}</dd>
          </div>
          <div>
            <dt>Service district</dt>
            <dd>{c.district}</dd>
          </div>
          <div>
            <dt>Your care provider</dt>
            <dd>{provider?.name || "The care team is arranging a provider"}</dd>
          </div>
        </dl>
        {visit.previousTime && (
          <div className="patient-revision-note">
            <Pencil size={15} />
            <p>
              Previous proposal: <s>{visit.previousTime}</s>
              <br />
              Please review the updated date and time above.
            </p>
          </div>
        )}
        {visit.changeRequest && (
          <div className="patient-pending-change">
            <MessageCircle size={18} />
            <div>
              <strong>Your change request is with the care team.</strong>
              <p>
                Preferred visit:{" "}
                {localDate(visit.changeRequest.date).toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "long" },
                )}{" "}
                at {visit.changeRequest.time} HKT.
              </p>
              {visit.changeRequest.note && <p>{visit.changeRequest.note}</p>}
              <small>
                The team needs to check provider availability. The current visit
                time stays in place until a revised proposal is agreed.
              </small>
            </div>
          </div>
        )}
        {changing ? (
          <div className="patient-change-form">
            <h3>What time would suit you better?</h3>
            <div className="form-grid">
              <Field label="Preferred date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Preferred time (HKT)">
                <input
                  type="time"
                  min="08:00"
                  max="17:45"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Anything the team should know? (optional)">
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example: I have an appointment that morning."
              />
            </Field>
            <p>
              We’ll save your preference for the care team. Provider
              availability must be checked before a revised visit can be
              confirmed.
            </p>
            <div className="button-row">
              <button className="button primary" onClick={requestChange}>
                Send change request <ArrowRight size={15} />
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setChanging(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : visit.status === "Proposed" && !visit.changeRequest ? (
          <div className="patient-approve-box">
            <h3>Does this visit work for you?</h3>
            <p>
              Check the proposed date, time and existing care tasks. You can
              approve this visit or ask for another time.
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              <span>
                I’ve reviewed this visit and agree to the proposed schedule.
              </span>
            </label>
            <div className="button-row">
              <button className="button primary" onClick={approve}>
                <Check size={15} />
                Approve this visit
              </button>
              <button
                className="button secondary"
                onClick={() => setChanging(true)}
              >
                <Pencil size={14} />
                Request a different time
              </button>
            </div>
          </div>
        ) : visit.status === "Confirmed" && !visit.changeRequest ? (
          <div className="patient-approve-box">
            <h3>
              <Check size={17} />
              You’ve approved this visit.
            </h3>
            <p>
              {provider
                ? "Your provider is confirmed. Your care team will coordinate the visit."
                : "Your schedule approval is saved. The care team still needs to confirm an available provider."}
            </p>
            <button
              className="button secondary"
              onClick={() => setChanging(true)}
            >
              <Pencil size={14} />
              Request a different time
            </button>
          </div>
        ) : visit.status === "Completed" ? (
          <div className="patient-approve-box">
            <h3>
              <Check size={17} />
              Visit marked complete by your provider.
            </h3>
            <p>Completion has been recorded in your care history.</p>
          </div>
        ) : null}
        {error && (
          <div className="error-box" role="alert">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <span className="modal-footer-note">
          <ShieldCheck size={14} />
          Your care team confirms clinical instructions.
        </span>
        <button className="button secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </ModalFrame>
  );
}

export function PatientDetailsModal({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, update, toast, patientClientId } = useApp();
  const c = data.cases.find(
    (c) => c.id === id && c.clientId === patientClientId,
  );
  const [draft, setDraft] = useState(c);
  const [error, setError] = useState("");
  if (!c || !draft) return null;
  const set = (key: keyof CareCase, value: string) =>
    setDraft({ ...draft, [key]: value });
  function save() {
    if (!draft || !c) return;
    if (!draft.name.trim()) {
      setError("Please add a name or fictional alias.");
      return;
    }
    const keys = [
      "name",
      "age",
      "district",
      "care",
      "background",
      "time",
      "duration",
      "contact",
    ] as const;
    if (keys.every((key) => draft[key] === c[key])) {
      onClose();
      return;
    }
    update((next) => {
      const care = next.cases.find((item) => item.id === id)!;
      keys.forEach((key) => (care[key] = draft[key].trim()));
      care.clinicalReviewed = false;
      care.familyAgreed = false;
      care.priceConfirmed = false;
      care.approved = false;
      care.status = "Under review";
      care.updatedAt = new Date().toISOString();
      const changes = keys
        .filter((key) => draft[key] !== c[key])
        .map((key) => `${key}: ${draft[key] || "Not provided"}`)
        .join("\n");
      care.original += `\n\nPatient corrections (${new Date().toISOString()}):\n${changes}`;
      // Recheck requirements before further visits can be approved or reminded.
      next.visits
        .filter((v) => v.caseId === id && v.status !== "Completed")
        .forEach((v) => {
          if (v.status === "Confirmed") {
            v.previousTime = `${v.date} ${v.time}`;
            v.version += 1;
            v.status = "Proposed";
          }
          v.instructionsConfirmed = false;
          v.reminder = "Not scheduled";
        });
      logEvent(
        next,
        "Patient corrected care request details",
        `${id} · Requirements and upcoming visits need care-team review`,
      );
    });
    toast(
      "Your corrections are saved. The care team needs to review the updated request.",
    );
    onClose();
  }
  return (
    <ModalFrame
      title="Let’s get your details right"
      eyebrow={`YOUR CARE REQUEST · ${id}`}
      onClose={onClose}
    >
      <div className="modal-body patient-modal-body">
        <p className="patient-dialog-intro">
          Check what you’ve shared and correct anything that needs updating.
          Changes go back to the care team for review.
        </p>
        <div className="form-grid">
          <Field label="Your name / fictional alias" required>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Age">
            <input
              type="number"
              min="0"
              max="120"
              value={draft.age}
              onChange={(e) => set("age", e.target.value)}
            />
          </Field>
          <Field label="Your service district">
            <Select
              label="Your service district"
              value={draft.district}
              onChange={(v) => set("district", v)}
              options={[{ value: "", label: "To be confirmed" }, ...DISTRICTS]}
            />
          </Field>
          <Field label="Contact details">
            <input
              value={draft.contact}
              onChange={(e) => set("contact", e.target.value)}
              placeholder="Fictional demo contact only"
            />
          </Field>
          <Field label="Help you’re requesting">
            <input
              value={draft.care}
              onChange={(e) => set("care", e.target.value)}
            />
          </Field>
          <Field label="Background you’ve shared">
            <input
              value={draft.background}
              onChange={(e) => set("background", e.target.value)}
            />
          </Field>
          <Field label="Preferred visit time">
            <input
              value={draft.time}
              onChange={(e) => set("time", e.target.value)}
              placeholder="To be confirmed"
            />
          </Field>
          <Field label="How long you need support">
            <input
              value={draft.duration}
              onChange={(e) => set("duration", e.target.value)}
              placeholder="Not yet confirmed"
            />
          </Field>
        </div>
        <details className="original-message">
          <summary>Your original enquiry</summary>
          <p>{c.original}</p>
        </details>
        <div className="info-callout small">
          <ShieldCheck size={18} />
          <p>
            Changes to your request need another review before care is
            confirmed. This form cannot change a treatment plan.
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" onClick={save}>
          Save my corrections <Check size={15} />
        </button>
      </div>
    </ModalFrame>
  );
}
export function PatientSupportModal({ onClose }: { onClose: () => void }) {
  const { data, update, toast, patientClientId } = useApp();
  const [question, setQuestion] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const c = data.cases.find((c) => c.clientId === patientClientId);
  function save() {
    if (!question.trim()) {
      setError("Add your question so the team knows what you need.");
      return;
    }
    update((next) =>
      logEvent(
        next,
        "Patient has a question for the care team",
        `${c?.id || "New enquiry"} · ${question.trim()}`,
      ),
    );
    setSent(true);
    toast("Your question was saved in the demo care-team activity log.");
  }
  return (
    <ModalFrame
      title={sent ? "Your question is saved" : "What would you like to know?"}
      eyebrow="A LITTLE MORE SUPPORT"
      onClose={onClose}
    >
      <div className="modal-body patient-modal-body">
        {sent ? (
          <>
            <div className="patient-approve-box">
              <h3>
                <Check size={18} />
                Saved with your care journey.
              </h3>
              <p>{question}</p>
            </div>
            <p className="patient-dialog-intro">
              This is a demonstration. Your question is recorded in this
              browser’s staff activity log; no message has been sent to a real
              care team.
            </p>
          </>
        ) : (
          <>
            <p className="patient-dialog-intro">
              Ask about your request, a proposed visit, or what happens next.
              This demo saves your question for review.
            </p>
            <Field label="Your question">
              <textarea
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="For example: Can a family member be present during the visit?"
              />
            </Field>
            <p className="form-hint">
              For immediate emergency assistance in Hong Kong, call 999. This
              prototype is not monitored.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          {sent ? "Done" : "Cancel"}
        </button>
        {!sent && (
          <button className="button primary" onClick={save}>
            Save my question <MessageCircle size={15} />
          </button>
        )}
      </div>
    </ModalFrame>
  );
}
