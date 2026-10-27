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
  HeartHandshake,
  LockKeyhole,
  MapPin,
  MessageCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useApp } from "../store";
import { Avatar, Badge, EmptyState, PageTitle, Select } from "../components";
import { today } from "../lib/workflow";

export function ProvidersPage() {
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
        eyebrow="GOOD PEOPLE. THOUGHTFUL CARE."
        title="Care providers"
        description="A trusted community of nurses and companions, ready to lend a hand."
      >
        <button
          className="button secondary"
          onClick={() => navigate("Care requests")}
        >
          <Users size={16} />
          Review applications
        </button>
      </PageTitle>
      <div className="provider-intro">
        <div className="provider-intro-icon">
          <HeartHandshake size={29} />
        </div>
        <div>
          <h2>The right person makes all the difference.</h2>
          <p>
            {data.providers.filter((p) => p.verified).length} verified providers
            · {data.providers.filter((p) => p.verified && p.available).length}{" "}
            currently available · Across Hong Kong
          </p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={13} />
          Verified with care
        </Badge>
      </div>
      <div className="standalone-filter filter-bar">
        <label className="table-search">
          <Search size={16} />
          <input
            aria-label="Search providers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search providers, districts or skills..."
          />
        </label>
        <div>
          <Select
            label="Provider type"
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
            label="Provider availability"
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
                {p.verified
                  ? p.available
                    ? "Available"
                    : "At capacity"
                  : "Pending verification"}
              </Badge>
            </div>
            <h3>
              {p.name}
              {p.verified && <ShieldCheck size={17} />}
            </h3>
            <p className="provider-category">{p.category}</p>
            <span className="provider-experience">
              {p.experience} years of experience
            </span>
            <div className="provider-districts">
              <MapPin size={14} />
              {p.districts.join(" · ")}
            </div>
            <div className="skill-tags">
              {p.skills.slice(0, 2).map((s) => (
                <span key={s}>{s}</span>
              ))}
              {p.skills.length > 2 && <span>+{p.skills.length - 2}</span>}
            </div>
            <div className="provider-card-footer">
              <span>
                {p.verified ? (
                  <>
                    <ShieldCheck size={13} />
                    Credentials checked · demo
                  </>
                ) : (
                  <>Verification required</>
                )}
              </span>
              <ArrowRight size={16} />
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState
          title="No providers in this view"
          description="Try another district, skill or provider type."
        />
      )}
      <div className="inline-note">
        <LockKeyhole size={17} />
        <p>
          All profiles use fictional demonstration data. Credentials,
          competencies and availability must be verified before any real
          assignment.
        </p>
      </div>
    </>
  );
}
export function MessagesPage() {
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
        eyebrow="KEEP EVERYONE IN THE LOOP."
        title="Care messages"
        description="Case opportunities and visit reminders, all in one thoughtful thread."
      >
        <button
          className="button secondary"
          onClick={() => navigate("Settings")}
        >
          Integration settings <ArrowRight size={15} />
        </button>
      </PageTitle>
      <section className="messaging-banner">
        <span className="whatsapp-icon">
          <MessageCircle size={29} />
        </span>
        <div>
          <Badge tone="amber" dot={false}>
            SIMULATED IN THIS PROTOTYPE
          </Badge>
          <h2>A familiar channel for better coordination.</h2>
          <p>
            Preview privacy-conscious case broadcasts and visit reminders.
            <br />
            No WhatsApp messages are sent from this frontend prototype.
          </p>
        </div>
        <div className="connection-label">
          <span />
          WhatsApp not connected
        </div>
      </section>
      <div className="section-bar">
        <h2>
          Message activity{" "}
          <span className="number-pill">{data.messages.length}</span>
        </h2>
        <Select
          label="Message type"
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
                    {m.type === "Broadcast"
                      ? "Provider case broadcast"
                      : "Scheduled visit reminder"}
                  </strong>
                  <small>
                    {m.caseId} ·{" "}
                    {new Date(m.createdAt).toLocaleString("en-HK", {
                      timeZone: "Asia/Hong_Kong",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </div>
                <Badge tone="amber" dot={false}>
                  Simulated
                </Badge>
              </div>
              <div className="message-bubble">
                <pre>{m.content}</pre>
                <span>
                  <CheckCheck size={15} />
                  Preview only · no delivery
                </span>
              </div>
              <div className="message-card-footer">
                <span>
                  <ShieldCheck size={13} />
                  {m.type === "Broadcast"
                    ? "Patient-identifying details excluded"
                    : "Sent only to the assigned provider in production"}
                </span>
                <button className="text-button" onClick={() => copy(m.content)}>
                  <Copy size={14} />
                  Copy text
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title="Good communication starts here"
            description="Publish an approved care request or simulate a confirmed visit reminder to see it here."
            action={
              <button
                className="button primary"
                onClick={() => navigate("Care requests")}
              >
                View care requests <ArrowRight size={15} />
              </button>
            }
          />
        </section>
      )}
      <div className="info-callout">
        <ShieldCheck size={22} />
        <div>
          <strong>Designed for an authorised messaging integration.</strong>
          <p>
            A production connection will need WhatsApp Business setup, opt-in
            records, approved templates, secure webhooks, delivery tracking and
            retries. Group automation is not assumed.
          </p>
        </div>
      </div>
    </>
  );
}
export function SettingsPage() {
  const { data, setModal, toast } = useApp();
  function exportBackup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `kindred-care-demo-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Demo workspace backup downloaded.");
  }
  return (
    <>
      <PageTitle
        eyebrow="A WORKSPACE THAT WORKS FOR YOU."
        title="Workspace settings"
        description="A clear view of what’s connected, what’s local, and what comes next."
      />
      <div className="settings-layout">
        <section className="panel settings-panel">
          <h2>Workspace details</h2>
          <div className="settings-row">
            <span>
              <strong>Workspace</strong>
              <small>Home-care navigation & coordination</small>
            </span>
            <span>Kindred Care · Hong Kong</span>
          </div>
          <div className="settings-row">
            <span>
              <strong>Time zone</strong>
              <small>All scheduled visits use local care-team time</small>
            </span>
            <Badge dot={false}>Asia/Hong_Kong · UTC+8</Badge>
          </div>
          <div className="settings-row">
            <span>
              <strong>Environment</strong>
              <small>Interactive frontend with fictional sample data</small>
            </span>
            <Badge tone="amber" dot={false}>
              Prototype
            </Badge>
          </div>
          <div className="settings-row">
            <span>
              <strong>Staff account</strong>
              <small>Role shown for demonstration only</small>
            </span>
            <span>Alex Chan · Care coordinator</span>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Connections & capabilities</h2>
          <div className="integration-row">
            <span className="integration-icon green">
              <Database size={22} />
            </span>
            <div>
              <strong>Browser storage</strong>
              <p>Cases, schedules and events persist in this browser.</p>
            </div>
            <Badge tone="green">Operational</Badge>
          </div>
          <div className="integration-row">
            <span className="integration-icon purple">
              <Sparkles size={22} />
            </span>
            <div>
              <strong>Enquiry extraction</strong>
              <p>
                Inspectable English / Traditional Chinese rules. No live AI
                model.
              </p>
            </div>
            <Badge tone="amber" dot={false}>
              Rules-based demo
            </Badge>
          </div>
          <div className="integration-row">
            <span className="integration-icon green">
              <MessageCircle size={22} />
            </span>
            <div>
              <strong>WhatsApp Business</strong>
              <p>Message previews and reminder simulation only.</p>
            </div>
            <Badge dot={false}>Not connected</Badge>
          </div>
          <div className="integration-row">
            <span className="integration-icon blue">
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>Authentication & secure database</strong>
              <p>To be connected during backend development.</p>
            </div>
            <Badge dot={false}>Planned</Badge>
          </div>
        </section>
        <section className="panel settings-panel">
          <h2>Demo data</h2>
          <div className="settings-row">
            <span>
              <strong>Download workspace data</strong>
              <small>Export the current demo records as JSON</small>
            </span>
            <button className="button secondary" onClick={exportBackup}>
              <Download size={16} />
              Download backup
            </button>
          </div>
          <div className="settings-row">
            <span>
              <strong>Reset demo workspace</strong>
              <small>
                Replace browser-saved changes with the original sample records
              </small>
            </span>
            <button
              className="button danger-secondary"
              onClick={() => setModal({ type: "reset" })}
            >
              <RotateCcw size={15} />
              Reset demo
            </button>
          </div>
        </section>
      </div>
      <div className="inline-note">
        <LockKeyhole size={18} />
        <p>
          This frontend has no access controls or secure server storage. Please
          use fictional information while exploring the prototype.
        </p>
        <button
          className="text-button"
          onClick={() => setModal({ type: "help" })}
        >
          Prototype guide <ChevronRight size={14} />
        </button>
      </div>
      <div className="prototype-status-grid">
        <div>
          <Check size={16} />
          <span>Interactive workflows</span>
        </div>
        <div>
          <Check size={16} />
          <span>Editable care requests</span>
        </div>
        <div>
          <Check size={16} />
          <span>Schedule revisions & approval</span>
        </div>
        <div>
          <ArrowDownToLine size={16} />
          <span>CSV & JSON exports</span>
        </div>
      </div>
    </>
  );
}
