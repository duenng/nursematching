import { useLocale } from "../i18n";
import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "../store";
import { Avatar, Badge, EmptyState, PageTitle, Select } from "../components";
import {
  localDate,
  shortDate,
  today,
  weekDates,
  WEEK_DAYS,
} from "../lib/workflow";
const HOUR_HEIGHT = 112;
export function SchedulePage() {
  const { t, locale } = useLocale();

  const { data, setModal } = useApp();
  const [anchor, setAnchor] = useState(today());
  const [view, setView] = useState("Week");
  const [filter, setFilter] = useState("All schedules");
  const [caseFilter, setCaseFilter] = useState("All clients");
  const dates = weekDates(anchor);
  const visits = data.visits.filter(
    (v) =>
      dates.includes(v.date) &&
      (filter === "All schedules" || v.status === filter) &&
      (caseFilter === "All clients" || v.caseId === caseFilter),
  );
  function changeWeek(dir: number) {
    const d = localDate(anchor);
    d.setDate(d.getDate() + dir * 7);
    setAnchor(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return (
    <>
      <PageTitle
        eyebrow={t("A THOUGHTFUL PLAN FOR THE DAYS AHEAD.")}
        title={t("Care schedule")}
        description={t(
          "Bring confirmed care needs into a schedule that works for everyone.",
        )}
      >
        <button
          className="button primary"
          onClick={() => setModal({ type: "schedule" })}
        >
          <Plus size={17} />
          {t("Propose a schedule")}
        </button>
      </PageTitle>
      <div className="schedule-summary">
        <span>
          <span className="legend-dot confirmed" />
          {visits.filter((v) => v.status === "Confirmed").length}{" "}
          {t("confirmed visits")}
        </span>
        <span>
          <span className="legend-dot proposed" />
          {visits.filter((v) => v.status === "Proposed").length}{" "}
          {t("awaiting family approval")}
        </span>
        <span>
          <span className="legend-dot completed" />
          {visits.filter((v) => v.status === "Completed").length}{" "}
          {t("completed")}
        </span>
        <p>
          <ShieldCheck size={15} />
          {t("Confirmed tasks. Human-approved care.")}
        </p>
      </div>
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-nav">
            <button
              className="button secondary compact-button"
              onClick={() => setAnchor(today())}
            >
              {t("Today")}
            </button>
            <button
              className="icon-button"
              aria-label={t("Previous week")}
              onClick={() => changeWeek(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="icon-button"
              aria-label={t("Next week")}
              onClick={() => changeWeek(1)}
            >
              <ChevronRight size={19} />
            </button>
            <h2>
              {t(shortDate(dates[0], locale))} –{" "}
              {t(shortDate(dates[6], locale))}
              <span>{t(localDate(dates[0]).getFullYear())}</span>
            </h2>
          </div>
          <div className="calendar-controls">
            <Select
              label={t("Filter schedule status")}
              value={filter}
              onChange={setFilter}
              options={[
                "All schedules",
                "Proposed",
                "Confirmed",
                "Completed",
                "Issue reported",
              ]}
            />
            <div className="view-switch">
              <button
                className={view === "Week" ? "selected" : ""}
                onClick={() => setView("Week")}
                aria-label={t("Week view")}
              >
                <CalendarDays size={16} />
              </button>
              <button
                className={view === "List" ? "selected" : ""}
                onClick={() => setView("List")}
                aria-label={t("List view")}
              >
                <List size={17} />
              </button>
            </div>
          </div>
        </div>
        <div className="calendar-client-filter">
          <Select
            label={t("Filter schedule by client")}
            value={caseFilter}
            onChange={setCaseFilter}
            options={[
              { value: "All clients", label: "All clients" },
              ...data.cases.map((c) => ({
                value: c.id,
                label: `${c.name} · ${c.id}`,
              })),
            ]}
          />
          <span>{t("All visit times in Hong Kong time")}</span>
        </div>
        {view === "Week" ? (
          <div className="calendar-scroll">
            <div className="week-calendar">
              <div className="calendar-day-header time-column">{t("HKT")}</div>
              {dates.map((d, i) => (
                <div
                  className={`calendar-day-header ${d === today() ? "is-today" : ""}`}
                  key={d}
                >
                  <span>{t(WEEK_DAYS[i])}</span>
                  <strong>{t(localDate(d).getDate())}</strong>
                  {d === today() && <small>{t("TODAY")}</small>}
                </div>
              ))}
              <div className="calendar-hours">
                {[
                  "08:00",
                  "09:00",
                  "10:00",
                  "11:00",
                  "12:00",
                  "13:00",
                  "14:00",
                  "15:00",
                  "16:00",
                  "17:00",
                ].map((time) => (
                  <span key={time}>{t(time)}</span>
                ))}
              </div>
              {dates.map((day) => (
                <div
                  className={`calendar-day ${day === today() ? "is-today" : ""}`}
                  key={day}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <div className="hour-slot" key={i} />
                  ))}
                  {visits
                    .filter((v) => v.date === day)
                    .map((v) => {
                      const c = data.cases.find((c) => c.id === v.caseId);
                      const minute =
                        Number(v.time.split(":")[0]) * 60 +
                        Number(v.time.split(":")[1]);
                      return (
                        <button
                          style={{
                            top: `${((minute - 480) / 60) * HOUR_HEIGHT + 3}px`,
                            height: Math.max(
                              (v.duration / 60) * HOUR_HEIGHT - 6,
                              50,
                            ),
                          }}
                          className={`calendar-event ${v.status.toLowerCase().replaceAll(" ", "-")} ${c?.color}`}
                          key={v.id}
                          onClick={() => setModal({ type: "visit", id: v.id })}
                        >
                          <span className="event-time">
                            {t(v.time)}
                            <span>
                              {t(
                                v.status === "Proposed"
                                  ? "Draft"
                                  : v.status === "Completed"
                                    ? "✓"
                                    : "",
                              )}
                            </span>
                          </span>
                          <strong>{c?.name}</strong>
                          <small>{t(v.tasks)}</small>
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="schedule-list-view">
            {dates.map((day) => {
              const dayVisits = visits
                .filter((v) => v.date === day)
                .sort((a, b) => a.time.localeCompare(b.time));
              return dayVisits.length ? (
                <div key={day} className="schedule-list-day">
                  <h3>
                    {t(
                      localDate(day).toLocaleDateString(locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }),
                    )}
                    {day === today() && (
                      <Badge tone="green" dot={false}>
                        {t("Today")}
                      </Badge>
                    )}
                  </h3>
                  {dayVisits.map((v) => {
                    const c = data.cases.find((c) => c.id === v.caseId);
                    const p = data.providers.find((p) => p.id === v.providerId);
                    return (
                      <button
                        className="schedule-list-item"
                        key={v.id}
                        onClick={() => setModal({ type: "visit", id: v.id })}
                      >
                        <span className="list-visit-time">
                          <Clock3 size={15} />
                          {t(v.time)}
                          <small>
                            {v.duration} {t("min")}
                          </small>
                        </span>
                        <Avatar name={c?.name || "?"} color={c?.color} />
                        <span className="list-visit-client">
                          <strong>{c?.name}</strong>
                          <small>{t(v.tasks)}</small>
                        </span>
                        <span className="list-visit-provider">
                          {t(p?.name || "Provider to confirm")}
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
                    );
                  })}
                </div>
              ) : null;
            })}
            {!visits.length && (
              <EmptyState
                title={t("Space for a new care journey")}
                description={t("There are no visits matching this view.")}
                action={
                  <button
                    className="button primary"
                    onClick={() => setModal({ type: "schedule" })}
                  >
                    {t("Propose a schedule")}
                  </button>
                }
              />
            )}
          </div>
        )}
      </section>
      <div className="inline-note">
        <ShieldCheck size={18} />
        <p>
          {t(
            "Schedules organise existing care instructions. They do not prescribe treatment or determine clinical frequency. Family approval confirms the schedule, while care decisions remain with qualified professionals.",
          )}
        </p>
      </div>
    </>
  );
}
