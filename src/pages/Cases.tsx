import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  Filter,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useApp } from "../store";
import {
  Avatar,
  Badge,
  CaseBadge,
  EmptyState,
  PageTitle,
  Select,
} from "../components";
import { csvCell, missingFields, today } from "../lib/workflow";
import type { CareCase } from "../types";

export function EnquiriesPage() {
  const { data, setModal, navigate } = useApp();
  const [filter, setFilter] = useState("All enquiries");
  const enquiries = data.cases.filter(
    (c) =>
      filter === "All enquiries" ||
      (filter === "Needs information"
        ? c.status === "Information required"
        : c.status === "Under review"),
  );
  return (
    <>
      <PageTitle
        eyebrow="A FIRST MESSAGE. A FRESH START."
        title="Care enquiries"
        description="Meet families where they are, and help them find their next step."
      >
        <button
          className="button primary"
          onClick={() => setModal({ type: "enquiry" })}
        >
          <Plus size={17} />
          New enquiry
        </button>
      </PageTitle>
      <section className="enquiry-intro">
        <div className="enquiry-intro-icon">
          <Sparkles size={27} />
        </div>
        <div>
          <Badge tone="green" dot={false}>
            CARE NAVIGATOR · DEMO
          </Badge>
          <h2>
            They bring the questions.
            <br />
            You bring the care.
          </h2>
          <p>
            A simple message in English or Chinese is all it takes to start.
            <br />
            Our prototype organises the details so your team can focus on
            people.
          </p>
          <button
            className="button primary"
            onClick={() => setModal({ type: "enquiry" })}
          >
            即時查詢服務 · Start an enquiry <ArrowRight size={16} />
          </button>
        </div>
        <div className="enquiry-intro-quote">
          <span>“</span>
          <p>
            我媽媽最近出院，
            <br />
            想搵護士上門幫手…
          </p>
          <small>Every story deserves a thoughtful response.</small>
          <MessageCircle size={32} />
        </div>
      </section>
      <div className="section-bar">
        <h2>
          A conversation worth continuing{" "}
          <span className="number-pill">{enquiries.length}</span>
        </h2>
        <Select
          label="Filter enquiries"
          value={filter}
          onChange={setFilter}
          options={["All enquiries", "Needs information", "Under review"]}
        />
      </div>
      <div className="enquiry-grid">
        {enquiries.map((c) => (
          <button
            key={c.id}
            className="enquiry-card panel"
            onClick={() => setModal({ type: "case", id: c.id })}
          >
            <div className="enquiry-card-header">
              <Avatar name={c.name} color={c.color} />
              <div>
                <strong>{c.name}</strong>
                <small>
                  {c.id} · {c.district}
                </small>
              </div>
              <ChevronRight size={18} />
            </div>
            <blockquote>{c.original}</blockquote>
            <div className="extraction-preview">
              <Sparkles size={14} />
              <span>{c.care || "Care needs to be clarified"}</span>
            </div>
            <div className="enquiry-card-footer">
              <CaseBadge status={c.status} />
              <span>
                {missingFields(c).length
                  ? `${missingFields(c).length} details to confirm`
                  : "Details captured"}
              </span>
            </div>
          </button>
        ))}
      </div>
      {!enquiries.length && (
        <EmptyState
          title="You’re all caught up"
          description="New family enquiries will appear here."
        />
      )}
      <div className="inline-note">
        <ShieldCheck size={17} />
        <p>
          Original messages are preserved alongside the structured enquiry.
          Every suggested care pathway needs staff review.
        </p>
        <button
          className="text-button"
          onClick={() => navigate("Care requests")}
        >
          View care requests <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}

function downloadCases(cases: CareCase[]) {
  const rows = [
    [
      "Case ID",
      "Client ID",
      "Client",
      "Age",
      "District",
      "Category",
      "Care requirements",
      "Days",
      "Time",
      "Duration",
      "Status",
      "Updated",
    ],
    ...cases.map((c) => [
      c.id,
      c.clientId,
      c.name,
      c.age,
      c.district,
      c.category,
      c.care,
      c.days.join("; "),
      c.time,
      c.duration,
      c.status,
      c.updatedAt,
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `kindred-care-records-${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function RequestsPage() {
  const { data, setModal, toast } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [category, setCategory] = useState("All care types");
  const filtered = data.cases.filter(
    (c) =>
      `${c.name} ${c.id} ${c.district} ${c.care}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "All statuses" || c.status === status) &&
      (category === "All care types" || c.category === category),
  );
  return (
    <>
      <PageTitle
        eyebrow="THE DETAILS THAT MAKE A DIFFERENCE."
        title="Care requests"
        description="One place for every care journey, from enquiry to a helping hand."
      >
        <button
          className="button secondary"
          onClick={() => {
            downloadCases(filtered);
            toast("Care records exported as CSV.");
          }}
        >
          <ArrowDownToLine size={16} />
          Export
        </button>
        <button
          className="button primary"
          onClick={() => setModal({ type: "enquiry" })}
        >
          <Plus size={17} />
          New care request
        </button>
      </PageTitle>
      <div className="mini-stats">
        <div>
          <span className="mini-stat-icon green">
            <FolderIcon />
          </span>
          <span>
            <small>Total care requests</small>
            <strong>{data.cases.length}</strong>
          </span>
        </div>
        <div>
          <span className="mini-stat-icon amber">
            <MessageCircle size={21} />
          </span>
          <span>
            <small>Awaiting review</small>
            <strong>
              {
                data.cases.filter((c) =>
                  ["Under review", "Information required"].includes(c.status),
                ).length
              }
            </strong>
          </span>
        </div>
        <div>
          <span className="mini-stat-icon purple">
            <Filter size={21} />
          </span>
          <span>
            <small>Finding a provider</small>
            <strong>
              {
                data.cases.filter((c) => c.status === "Awaiting providers")
                  .length
              }
            </strong>
          </span>
        </div>
        <div>
          <span className="mini-stat-icon blue">
            <Check size={21} />
          </span>
          <span>
            <small>Care in progress</small>
            <strong>
              {
                data.cases.filter((c) =>
                  ["Service active", "Provider confirmed"].includes(c.status),
                ).length
              }
            </strong>
          </span>
        </div>
      </div>
      <section className="panel">
        <div className="filter-bar">
          <label className="table-search">
            <Search size={16} />
            <input
              aria-label="Search care requests"
              placeholder="Search by name, case ID or district..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div>
            <Select
              label="Case status"
              value={status}
              onChange={setStatus}
              options={[
                "All statuses",
                "Information required",
                "Under review",
                "Ready to publish",
                "Awaiting providers",
                "Provider confirmed",
                "Service active",
                "Completed",
              ]}
            />
            <Select
              label="Care category"
              value={category}
              onChange={setCategory}
              options={[
                "All care types",
                "Registered nurse",
                "Enrolled nurse",
                "Care companion",
                "Needs review",
              ]}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="care-table large-table">
            <thead>
              <tr>
                <th>CLIENT / CASE</th>
                <th>CARE NEEDED</th>
                <th>DISTRICT</th>
                <th>PREFERRED TIME</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
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
                          {c.id} · {c.age || "Age unknown"}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="care-type">
                      {c.care || "To be confirmed"}
                    </span>
                    <span className="cell-subtitle">{c.category}</span>
                  </td>
                  <td>{c.district || "To be confirmed"}</td>
                  <td>
                    <span className="care-type">
                      {c.time || "To be confirmed"}
                    </span>
                    <span className="cell-subtitle">
                      {c.days.join(", ") || "Days to confirm"}
                    </span>
                  </td>
                  <td>
                    <CaseBadge status={c.status} />
                  </td>
                  <td>
                    <button
                      className="row-arrow"
                      aria-label={`Review ${c.id}`}
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
        {!filtered.length && (
          <EmptyState
            title="No matching care requests"
            description="Try another search or change the filters."
          />
        )}
        <div className="panel-table-footer">
          <span>
            {filtered.length} care request{filtered.length === 1 ? "" : "s"}
          </span>
          <span>
            <ShieldCheck size={13} />
            Private to the care coordination team
          </span>
        </div>
      </section>
    </>
  );
}
function FolderIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 13h6m-3-3v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function ClientsPage() {
  const { data, setModal, toast } = useApp();
  const [query, setQuery] = useState("");
  const clientIds = [...new Set(data.cases.map((c) => c.clientId))];
  const clients = clientIds
    .map((id) => ({ id, cases: data.cases.filter((c) => c.clientId === id) }))
    .filter((client) =>
      `${client.cases[0].name} ${client.id} ${client.cases[0].district}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  return (
    <>
      <PageTitle
        eyebrow="MORE THAN A RECORD. A PERSON."
        title="Client records"
        description="Keep each family’s information and care history connected."
      >
        <button
          className="button secondary"
          onClick={() => {
            downloadCases(data.cases);
            toast("Client records exported.");
          }}
        >
          <ArrowDownToLine size={16} />
          Export records
        </button>
      </PageTitle>
      <div className="info-callout">
        <ShieldCheck size={21} />
        <div>
          <strong>Thoughtfully connected, carefully kept.</strong>
          <p>
            This prototype links repeat enquiries only when an existing client
            is explicitly selected. Similar names are never automatically
            merged.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="filter-bar">
          <label className="table-search">
            <Search size={16} />
            <input
              aria-label="Search clients"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by client name, ID or district..."
            />
          </label>
          <span className="results-count">{clients.length} client records</span>
        </div>
        <div className="table-scroll">
          <table className="care-table large-table">
            <thead>
              <tr>
                <th>CLIENT</th>
                <th>DISTRICT</th>
                <th>LINKED CASES</th>
                <th>LATEST CARE REQUEST</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const c = client.cases[0];
                return (
                  <tr
                    key={client.id}
                    onClick={() => setModal({ type: "case", id: c.id })}
                  >
                    <td>
                      <div className="client-cell">
                        <Avatar name={c.name} color={c.color} />
                        <span>
                          <strong>{c.name}</strong>
                          <small>
                            {client.id} · Age {c.age || "unknown"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{c.district || "To confirm"}</td>
                    <td>
                      <Badge dot={false}>
                        {client.cases.length} case
                        {client.cases.length === 1 ? "" : "s"}
                      </Badge>
                    </td>
                    <td>
                      <span className="care-type">
                        {c.care || "Not yet confirmed"}
                      </span>
                      <span className="cell-subtitle">{c.id}</span>
                    </td>
                    <td>
                      <CaseBadge status={c.status} />
                    </td>
                    <td>
                      <button
                        className="row-arrow"
                        aria-label={`Open ${c.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ type: "case", id: c.id });
                        }}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!clients.length && (
          <EmptyState
            title="No matching clients"
            description="Try a different name or district."
          />
        )}
      </section>
    </>
  );
}
