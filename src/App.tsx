import { LanguageSwitcher, useLocale } from "./i18n";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FolderHeart,
  FlaskConical,
  Heart,
  HeartHandshake,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppProvider, useApp } from "./store";
import {
  Avatar,
  Badge,
  CaseBadge,
  DateLabel,
  EmptyState,
  Logo,
  PageTitle,
  Select,
  Trend,
} from "./components";
import type { Page } from "./types";
import {
  shortDate,
  today,
  localDate,
  csvCell,
  weekDates,
} from "./lib/workflow";
import { EnquiriesPage, RequestsPage, ClientsPage } from "./pages/Cases";
import { SchedulePage } from "./pages/Schedule";
import { ProvidersPage, MessagesPage, SettingsPage } from "./pages/Operations";
import { Modals } from "./Modals";
import { CareIllustration } from "./CareIllustration";
import { EmailValidation, PublicEmailEnquiry } from "./pages/EmailValidation";
import { PatientPortal } from "./pages/Patient";

const navItems: { label: Page; icon: LucideIcon; group: string }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Care enquiries", icon: MessageCircle, group: "WORKSPACE" },
  { label: "Care requests", icon: ClipboardList, group: "WORKSPACE" },
  { label: "Care schedule", icon: CalendarDays, group: "WORKSPACE" },
  { label: "Care providers", icon: HeartHandshake, group: "MANAGE" },
  { label: "Email validation", icon: FlaskConical, group: "MANAGE" },
  { label: "Messages", icon: MessageCircle, group: "MANAGE" },
  { label: "Client records", icon: FolderHeart, group: "MANAGE" },
];

function Shell() {
  const { t } = useLocale();

  const { data, page, navigate, setModal, notification, switchView } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchArea = useRef<HTMLDivElement>(null);
  const noticeArea = useRef<HTMLDivElement>(null);
  const profileArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNoticeOpen(false);
        setProfileOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!searchArea.current?.contains(target)) setSearchOpen(false);
      if (!noticeArea.current?.contains(target)) setNoticeOpen(false);
      if (!profileArea.current?.contains(target)) setProfileOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);
  const results = data.cases
    .filter((c) =>
      `${c.name} ${c.id} ${c.district}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 4);
  const providerResults = data.providers
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 2);
  const newCount = data.cases.filter((c) =>
    ["Information required", "Under review"].includes(c.status),
  ).length;
  function go(p: Page) {
    navigate(p);
    setMobileOpen(false);
  }
  return (
    <div className="app-shell">
      {mobileOpen && (
        <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <button
          className="brand-button"
          onClick={() => go("Overview")}
          aria-label={t("CareKoala home")}
        >
          <Logo />
        </button>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Heart size={16} />
          </span>
          <span>
            <strong>{t("Care coordination")}</strong>
            <small>{t("Hong Kong workspace")}</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <nav aria-label={t("Main navigation")}>
          {["WORKSPACE", "MANAGE"].map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-label">{t(group)}</p>
              {navItems
                .filter((i) => i.group === group)
                .map((item) => (
                  <button
                    className={`nav-item ${page === item.label ? "active" : ""}`}
                    key={item.label}
                    aria-label={t(item.label)}
                    onClick={() => go(item.label)}
                  >
                    <item.icon size={19} strokeWidth={1.7} />
                    <span>{t(item.label)}</span>
                    {item.label === "Care enquiries" && newCount > 0 && (
                      <span className="nav-count">{t(newCount)}</span>
                    )}
                    {item.label === "Messages" && <span className="nav-dot" />}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="navigator-promo">
            <span className="promo-stars">
              <Sparkles size={22} />
              <span>✧</span>
            </span>
            <h3>{t("A little help, a lot of care.")}</h3>
            <p>{t("Turn a family’s first message into their next step.")}</p>
            <button onClick={() => setModal({ type: "enquiry" })}>
              {t("Open care navigator")} <ArrowRight size={15} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "Settings" ? "active" : ""}`}
            onClick={() => go("Settings")}
          >
            <Settings size={18} strokeWidth={1.7} />
            <span>{t("Settings")}</span>
          </button>
          <button
            className="nav-item"
            onClick={() => setModal({ type: "help" })}
          >
            <CircleHelp size={18} strokeWidth={1.7} />
            <span>{t("Help & resources")}</span>
            <ArrowUpRightIcon />
          </button>
          <div className="sidebar-footer">
            <span className="security-dot" />
            {t("Made for care. Built on trust.")}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={t("Open menu")}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              {t("Workspace")} <ChevronRight size={14} />
              <strong>{t(page)}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <LanguageSwitcher />
            <button
              className="staff-patient-preview"
              onClick={() => switchView("patient")}
            >
              <Heart size={14} />
              {t("Patient view")}
            </button>
            <div className="global-search" ref={searchArea}>
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label={t("Search workspace")}
                placeholder={t("Search anything...")}
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
              />
              <kbd>{t("⌘ K")}</kbd>
              {searchOpen && (
                <div className="search-results">
                  <div className="dropdown-label">
                    {t(query ? "SEARCH RESULTS" : "RECENT CASES")}
                  </div>
                  {results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setModal({ type: "case", id: c.id });
                        setSearchOpen(false);
                        setQuery("");
                      }}
                    >
                      <Avatar name={c.name} color={c.color} size="sm" />
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {t(c.id)} · {t(c.district)}
                        </small>
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                  {query &&
                    providerResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setModal({ type: "provider", id: p.id });
                          setSearchOpen(false);
                          setQuery("");
                        }}
                      >
                        <Avatar name={p.name} color={p.color} size="sm" />
                        <span>
                          <strong>{p.name}</strong>
                          <small>{t(p.category)}</small>
                        </span>
                      </button>
                    ))}
                  {!results.length && !providerResults.length && (
                    <p className="no-results">{t("No matching records.")}</p>
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <Badge tone="demo" dot={false}>
              {t("Prototype")}
            </Badge>
            <div className="notification-wrap" ref={noticeArea}>
              <button
                className="icon-button notification-button"
                aria-label={t("Notifications")}
                aria-expanded={noticeOpen}
                onClick={() => setNoticeOpen(!noticeOpen)}
              >
                <Bell size={19} />
                <span />
              </button>
              {noticeOpen && (
                <div className="notification-menu">
                  <div className="dropdown-label">
                    {t("WORKSPACE ACTIVITY")}
                  </div>
                  {data.activities.slice(0, 4).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        navigate(
                          a.kind === "schedule"
                            ? "Care schedule"
                            : a.kind === "provider"
                              ? "Care providers"
                              : a.kind === "message"
                                ? "Messages"
                                : "Care enquiries",
                        );
                        setNoticeOpen(false);
                      }}
                    >
                      <span className={`activity-icon ${a.kind}`}>
                        <Check size={15} />
                      </span>
                      <span>
                        <strong>{t(a.text)}</strong>
                        <small>{t(a.detail)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="profile-wrap" ref={profileArea}>
              <button
                className="profile-button"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label={t("Profile menu")}
              >
                <Avatar name="Alex Chan" color="profile" size="sm" />
                <ChevronDown size={13} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <strong>{t("Alex Chan")}</strong>
                  <small>{t("Care coordinator · Demo account")}</small>
                  <button
                    onClick={() => {
                      go("Settings");
                      setProfileOpen(false);
                    }}
                  >
                    <Settings size={15} />
                    {t("Workspace settings")}
                  </button>
                  <button
                    onClick={() => {
                      setModal({ type: "help" });
                      setProfileOpen(false);
                    }}
                  >
                    <CircleHelp size={15} />
                    {t("About the prototype")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="main-content" key={page}>
          {page === "Overview" ? (
            <Overview />
          ) : page === "Care enquiries" ? (
            <EnquiriesPage />
          ) : page === "Care requests" ? (
            <RequestsPage />
          ) : page === "Care schedule" ? (
            <SchedulePage />
          ) : page === "Care providers" ? (
            <ProvidersPage />
          ) : page === "Email validation" ? (
            <EmailValidation />
          ) : page === "Messages" ? (
            <MessagesPage />
          ) : page === "Client records" ? (
            <ClientsPage />
          ) : (
            <SettingsPage />
          )}
          <footer className="content-footer">
            <span>
              <Logo compact />
              {t("Care, connected.")}
            </span>
            <span>
              {t("Hong Kong")} <span className="footer-dot">·</span>{" "}
              {t("All times in HKT (UTC+8)")}
              <span className="footer-dot">·</span>
              {t("Frontend prototype")}
            </span>
          </footer>
        </main>
      </div>
      <Modals />
      {notification && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {t(notification)}
        </div>
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <path
        d="M5 15 15 5M5 5h10v10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Overview() {
  const { t, locale } = useLocale();

  const { data, navigate, setModal, toast } = useApp();
  const [caseTab, setCaseTab] = useState("All cases");
  const [period, setPeriod] = useState("This week");
  const [scheduleOffset, setScheduleOffset] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentDate = today();
  const dates = weekDates();
  const visibleDate = (() => {
    const d = localDate(currentDate);
    d.setDate(d.getDate() + scheduleOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const visits = data.visits
    .filter((v) => v.date === visibleDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const filteredCases = data.cases
    .filter(
      (c) =>
        caseTab === "All cases" ||
        (caseTab === "Needs attention" &&
          ["Under review", "Information required"].includes(c.status)) ||
        (caseTab === "Active" &&
          ["Service active", "Provider confirmed"].includes(c.status)),
    )
    .slice(0, 5);
  const active = data.cases.filter((c) =>
    ["Service active", "Provider confirmed"].includes(c.status),
  ).length;
  const attention = data.cases.filter((c) =>
    ["Under review", "Information required"].includes(c.status),
  ).length;
  const available = data.providers.filter(
    (p) => p.verified && p.available,
  ).length;
  const periodVisits = data.visits.filter((v) =>
    period === "This week"
      ? dates.includes(v.date)
      : v.date.slice(0, 7) === currentDate.slice(0, 7),
  );
  const total = data.cases.filter((c) => c.status !== "Completed").length;
  const stages = [
    { label: "Enquiry & review", count: attention, color: "#ddb27b" },
    {
      label: "Finding a provider",
      count: data.cases.filter((c) =>
        ["Ready to publish", "Awaiting providers"].includes(c.status),
      ).length,
      color: "#b392c8",
    },
    { label: "Care in progress", count: active, color: "#750f6d" },
    {
      label: "Care completed",
      count: data.cases.filter((c) => c.status === "Completed").length,
      color: "#d6b9e0",
    },
  ];
  function exportOverview() {
    const rows = [
      ["Case ID", "Client", "District", "Care", "Status"],
      ...data.cases.map((c) => [c.id, c.name, c.district, c.care, c.status]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `carekoala-overview-${today()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Overview report downloaded.");
    setMenuOpen(false);
  }
  return (
    <>
      <PageTitle
        eyebrow={t("A LITTLE CLARITY. A LOT OF CARE.")}
        title={t(`${greeting}, Alex`)}
        description={t(
          "Here’s what’s happening across your care community today.",
        )}
      >
        <span className="date-display">
          <CalendarDays size={15} />
          <DateLabel />
        </span>
        <button
          className="button primary"
          onClick={() => setModal({ type: "enquiry" })}
        >
          <Plus size={17} />
          {t("New enquiry")}
        </button>
      </PageTitle>
      <section className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-kicker">
            <span />
            {t("PEOPLE FIRST. ALWAYS.")}
          </span>
          <h2>
            {t("Good care begins")}
            <br />
            {t("with a connection.")}
          </h2>
          <p>
            {t("From a family’s first question to a nurse at their door,")}
            <br className="desktop-break" />{" "}
            {t("bring every step of care together.")}
          </p>
          <button onClick={() => setModal({ type: "enquiry" })}>
            {t("Let’s find the right care")} <ArrowRight size={16} />
          </button>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <CareIllustration />
        </div>
        <div className="welcome-note">
          <span className="note-heart">
            <Heart size={15} fill="currentColor" />
          </span>
          <span>
            {t("A little support.")}
            <br />
            <strong>{t("A world of difference.")}</strong>
          </span>
        </div>
        <span className="banner-corner">✦</span>
      </section>
      <div className="section-bar">
        <h2>
          {t("Your workspace at a glance")}
          {t(" ")}
          <span className="live-label">
            <span />
            {t("Live overview")}
          </span>
        </h2>
        <Select
          label={t("Reporting period")}
          value={period}
          onChange={setPeriod}
          options={["This week", "This month"]}
        />
      </div>
      <section className="stat-grid" aria-label={t("Workspace statistics")}>
        <StatCard
          label={t("Active care cases")}
          value={String(active).padStart(2, "0")}
          icon={FolderHeart}
          tone="green"
          detail="Families currently supported"
          onClick={() => navigate("Care requests")}
        >
          <Trend>
            {total} {t("open cases")}
          </Trend>
        </StatCard>
        <StatCard
          label={t("Enquiries to review")}
          value={String(attention).padStart(2, "0")}
          icon={MessageCircle}
          tone="amber"
          detail="Let’s help them take the next step"
          onClick={() => navigate("Care enquiries")}
        >
          <span className="stat-attention">
            <span />
            {t("Needs your attention")}
          </span>
        </StatCard>
        <StatCard
          label={t("Scheduled visits")}
          value={String(periodVisits.length).padStart(2, "0")}
          icon={CalendarDays}
          tone="purple"
          detail={
            period === "This week"
              ? "Planned for this week"
              : "Planned for this month"
          }
          onClick={() => navigate("Care schedule")}
        >
          <Trend>
            {periodVisits.filter((v) => v.status === "Confirmed").length}
            {t(" ")}
            {t("confirmed")}
          </Trend>
        </StatCard>
        <StatCard
          label={t("Available providers")}
          value={String(available).padStart(2, "0")}
          icon={HeartHandshake}
          tone="blue"
          detail="Verified and ready to make a difference"
          onClick={() => navigate("Care providers")}
        >
          <span className="provider-stat-avatars">
            {data.providers
              .filter((p) => p.verified && p.available)
              .slice(0, 3)
              .map((p) => (
                <Avatar key={p.id} name={p.name} color={p.color} size="sm" />
              ))}
            <span>{t("in your network")}</span>
          </span>
        </StatCard>
      </section>
      <div className="dashboard-columns">
        <div className="dashboard-main">
          <section className="panel recent-panel">
            <div className="panel-header">
              <div>
                <h2>
                  {t("Recent care requests")}
                  {t(" ")}
                  <span className="number-pill">{data.cases.length}</span>
                </h2>
                <p>
                  {t("A helping hand, from first enquiry to ongoing care.")}
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("Care requests")}
              >
                {t("View all requests")} <ArrowRight size={14} />
              </button>
            </div>
            <div className="table-toolbar">
              <div className="segmented-tabs">
                {["All cases", "Needs attention", "Active"].map((tab) => (
                  <button
                    key={tab}
                    className={caseTab === tab ? "selected" : ""}
                    onClick={() => setCaseTab(tab)}
                  >
                    {t(tab)}
                    {tab === "Needs attention" && <span>{attention}</span>}
                  </button>
                ))}
              </div>
              <div className="small-menu-wrap">
                <button
                  className="icon-button"
                  aria-label={t("Care request options")}
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  <MoreHorizontal size={19} />
                </button>
                {menuOpen && (
                  <div className="small-menu">
                    <button onClick={exportOverview}>
                      <ArrowDownToLine size={15} />
                      {t("Export CSV")}
                    </button>
                    <button
                      onClick={() => {
                        navigate("Care requests");
                        setMenuOpen(false);
                      }}
                    >
                      {t("Manage all requests")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="table-scroll">
              <table className="care-table">
                <thead>
                  <tr>
                    <th>{t("CLIENT / CASE")}</th>
                    <th>{t("CARE NEEDED")}</th>
                    <th>{t("DISTRICT")}</th>
                    <th>{t("STATUS")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setModal({ type: "case", id: c.id })}
                    >
                      <td>
                        <div className="client-cell">
                          <Avatar name={c.name} color={c.color} />
                          <span>
                            <strong>{c.name}</strong>
                            <small>
                              {t(c.id)} <span>·</span> {c.age} {t("years old")}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="care-type">
                          {t(c.care.split(",")[0])}
                        </span>
                        <span className="cell-subtitle">
                          {t(
                            c.category === "Needs review"
                              ? "Scope to be confirmed"
                              : c.category,
                          )}
                        </span>
                      </td>
                      <td>
                        <span className="district-cell">{t(c.district)}</span>
                      </td>
                      <td>
                        <CaseBadge status={c.status} />
                      </td>
                      <td>
                        <button
                          className="row-arrow"
                          aria-label={t(`Open ${c.id}`)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setModal({ type: "case", id: c.id });
                          }}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredCases.length && (
              <EmptyState
                title={t("All caught up")}
                description={t("No care requests in this view.")}
              />
            )}
            <div className="panel-table-footer">
              <span>
                <ShieldCheck size={13} />
                {t("Every case is reviewed by a real person.")}
              </span>
              <span>
                {t("Showing")} {filteredCases.length} {t("of")}{" "}
                {data.cases.length} {t("cases")}
              </span>
            </div>
          </section>
          <section className="navigator-banner">
            <div className="navigator-icon">
              <Sparkles size={24} />
            </div>
            <div>
              <span className="eyebrow">{t("MEET YOUR CARE NAVIGATOR")}</span>
              <h3>{t("Less paperwork. More people.")}</h3>
              <p>
                {t(
                  "Turn a family’s words into a clear, structured care enquiry.",
                )}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => setModal({ type: "enquiry" })}
            >
              {t("Try the navigator")} <ArrowRight size={15} />
            </button>
            <span className="navigator-decoration">✧</span>
          </section>
          <section className="panel pipeline-panel">
            <div className="panel-header compact">
              <div>
                <h2>{t("Every step, connected")}</h2>
                <p>{t("A snapshot of the care journey.")}</p>
              </div>
              <Badge dot={false}>{t("All cases")}</Badge>
            </div>
            <div className="pipeline-bar">
              {stages
                .filter((s) => s.count)
                .map((stage) => (
                  <span
                    key={stage.label}
                    style={{ flex: stage.count, background: stage.color }}
                  />
                ))}
            </div>
            <div className="pipeline-stages">
              {stages.map((stage, i) => (
                <button
                  key={stage.label}
                  onClick={() =>
                    navigate(
                      i === 0
                        ? "Care enquiries"
                        : i === 1
                          ? "Care providers"
                          : "Care requests",
                    )
                  }
                >
                  <span
                    className="pipeline-dot"
                    style={{ background: stage.color }}
                  />
                  <span>{t(stage.label)}</span>
                  <strong>{t(String(stage.count).padStart(2, "0"))}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="dashboard-rail">
          <section className="panel today-panel">
            <div className="panel-header compact">
              <h2>
                {t(
                  scheduleOffset === 0
                    ? "Today’s visits"
                    : shortDate(visibleDate, locale),
                )}
                <span className="number-pill">{visits.length}</span>
              </h2>
              <div className="mini-nav">
                <button
                  aria-label={t("Previous day")}
                  onClick={() => setScheduleOffset(scheduleOffset - 1)}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  aria-label={t("Next day")}
                  onClick={() => setScheduleOffset(scheduleOffset + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
            <div className="today-date">
              <span className="today-dot" />
              {t(
                localDate(visibleDate).toLocaleDateString(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }),
              )}
              <span>{t("HKT")}</span>
            </div>
            <div className="visit-list">
              {visits.slice(0, 3).map((v) => {
                const c = data.cases.find((c) => c.id === v.caseId);
                const provider = data.providers.find(
                  (p) => p.id === v.providerId,
                );
                return (
                  <button
                    className={`today-visit ${v.status === "Proposed" ? "proposed" : ""}`}
                    key={v.id}
                    onClick={() => setModal({ type: "visit", id: v.id })}
                  >
                    <span className="visit-time">
                      {t(v.time)}
                      <span>
                        {v.duration} {t("min")}
                      </span>
                    </span>
                    <span className="visit-content">
                      <strong>{c?.name}</strong>
                      <span>{t(v.tasks.split(",")[0])}</span>
                      <small>
                        {provider ? (
                          <>
                            <Avatar
                              name={provider.name}
                              color={provider.color}
                              size="sm"
                            />
                            {provider.name}
                          </>
                        ) : (
                          <>
                            <span className="tiny-dot" />
                            {t("Awaiting confirmation")}
                          </>
                        )}
                      </small>
                    </span>
                    <span
                      className={`visit-status-dot ${v.status.toLowerCase()}`}
                    />
                  </button>
                );
              })}
              {!visits.length && (
                <div className="quiet-day">
                  <CalendarDays size={25} />
                  <strong>{t("A little room to breathe.")}</strong>
                  <p>{t("No visits scheduled for this day.")}</p>
                </div>
              )}
            </div>
            <button
              className="rail-footer-button"
              onClick={() => navigate("Care schedule")}
            >
              {t("View care schedule")} <ArrowRight size={15} />
            </button>
          </section>
          <section className="panel activity-panel">
            <div className="panel-header compact">
              <h2>{t("Around your workspace")}</h2>
              <span className="activity-live-dot" />
            </div>
            <div className="activity-list">
              {data.activities.slice(0, 3).map((a, i) => (
                <div className="activity-item" key={a.id}>
                  <span className={`activity-icon ${a.kind}`}>
                    {a.kind === "case" ? (
                      <MessageCircle size={15} />
                    ) : a.kind === "provider" ? (
                      <Users size={15} />
                    ) : a.kind === "message" ? (
                      <Bell size={15} />
                    ) : (
                      <Check size={15} />
                    )}
                  </span>
                  <div>
                    <strong>{t(a.text)}</strong>
                    <p>{t(a.detail)}</p>
                    <small>
                      {t(
                        i === 0
                          ? "Just recently"
                          : new Date(a.time).toLocaleTimeString(locale, {
                              timeZone: "Asia/Hong_Kong",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                      )}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="activity-footnote">
              <span />
              {t("Everything up to date. You’re in good hands.")}
            </div>
          </section>
          <div className="human-note">
            <span className="human-note-icon">
              <ShieldCheck size={22} />
            </span>
            <div>
              <h3>{t("Technology with a human touch.")}</h3>
              <p>
                {t(
                  "AI helps organise. Qualified people make the care decisions.",
                )}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  detail,
  children,
  onClick,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  detail: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { t } = useLocale();

  return (
    <button className={`stat-card stat-${tone}`} onClick={onClick}>
      <div className="stat-top">
        <span>{t(label)}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={19} strokeWidth={1.7} />
        </span>
      </div>
      <div className="stat-number">
        {t(value)}
        <span className="stat-mini-line">
          <svg width="74" height="28" viewBox="0 0 74 28" fill="none">
            <path
              d={
                tone === "green"
                  ? "M1 24L12 18L23 20L33 10L45 14L55 6L65 8L73 1"
                  : tone === "purple"
                    ? "M1 22L13 22L22 13L34 17L45 8L56 10L64 4L73 2"
                    : tone === "amber"
                      ? "M1 17L12 17L22 11L33 16L44 9L55 14L64 7L73 8"
                      : "M1 23L13 19L24 20L34 12L44 13L54 7L64 8L73 3"
              }
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <p>{t(detail)}</p>
      <div className="stat-bottom">{children}</div>
    </button>
  );
}

export default function App() {
  return (
    <AppProvider>
      <PortalView />
    </AppProvider>
  );
}

function PortalView() {
  const { view } = useApp();
  const [publicEnquiry, setPublicEnquiry] = useState(
    window.location.hash.startsWith("#enquire"),
  );
  useEffect(() => {
    const change = () =>
      setPublicEnquiry(window.location.hash.startsWith("#enquire"));
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  if (publicEnquiry) return <PublicEmailEnquiry />;
  return view === "staff" ? <Shell /> : <PatientPortal />;
}
