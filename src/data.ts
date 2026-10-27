import type { CareCase, Store, Provider, Visit } from "./types";
import { today, weekDates } from "./lib/workflow";

const providers: Provider[] = [
  {
    id: "P-001",
    name: "Michelle Chan",
    initials: "MC",
    category: "Registered nurse",
    verified: true,
    registration: "RN · demo registration",
    districts: ["Sha Tin", "Tai Po", "Kowloon City"],
    skills: [
      "Wound care",
      "Blood glucose monitoring",
      "Blood pressure monitoring",
    ],
    experience: 8,
    available: true,
    optIn: true,
    color: "peach",
  },
  {
    id: "P-002",
    name: "Daniel Wong",
    initials: "DW",
    category: "Registered nurse",
    verified: true,
    registration: "RN · demo registration",
    districts: ["Kowloon City", "Wong Tai Sin", "Kwun Tong"],
    skills: [
      "Wound care",
      "Blood glucose monitoring",
      "Blood pressure monitoring",
      "Catheter care",
    ],
    experience: 6,
    available: true,
    optIn: true,
    color: "blue",
  },
  {
    id: "P-003",
    name: "Sarah Lee",
    initials: "SL",
    category: "Enrolled nurse",
    verified: true,
    registration: "EN · demo registration",
    districts: ["Central & Western", "Wan Chai", "Eastern"],
    skills: ["Blood pressure monitoring"],
    experience: 5,
    available: true,
    optIn: true,
    color: "lavender",
  },
  {
    id: "P-004",
    name: "Grace Ho",
    initials: "GH",
    category: "Care companion",
    verified: true,
    registration: "Identity verified · demo",
    districts: ["Sha Tin", "Kowloon City", "Yau Tsim Mong"],
    skills: ["Appointment accompaniment"],
    experience: 4,
    available: true,
    optIn: true,
    color: "green",
  },
  {
    id: "P-005",
    name: "Emily Cheung",
    initials: "EC",
    category: "Registered nurse",
    verified: true,
    registration: "RN · demo registration",
    districts: ["Sha Tin", "Tai Po", "Sai Kung"],
    skills: [
      "Wound care",
      "Blood glucose monitoring",
      "Blood pressure monitoring",
    ],
    experience: 10,
    available: false,
    optIn: true,
    color: "rose",
  },
  {
    id: "P-006",
    name: "Alex Lau",
    initials: "AL",
    category: "Care companion",
    verified: false,
    registration: "Verification pending",
    districts: ["Tuen Mun", "Yuen Long"],
    skills: ["Appointment accompaniment"],
    experience: 2,
    available: true,
    optIn: false,
    color: "sand",
  },
];
export function createSeed(): Store {
  const dates = weekDates();
  const date = today();
  const now = new Date().toISOString();
  const base = {
    age: "78",
    background: "",
    days: ["Mon", "Wed", "Fri"],
    time: "09:00–10:00",
    duration: "2 weeks",
    contact: "Demo contact on file",
    budget: "HK$650 / visit",
    notes: "",
    date,
    createdAt: now,
    updatedAt: now,
    consent: true,
    clinicalReviewed: true,
    familyAgreed: true,
    priceConfirmed: true,
    approved: true,
    applications: [],
  };
  const cases: CareCase[] = [
    {
      ...base,
      id: "HK-0024",
      clientId: "C-0024",
      name: "Mrs. Wong",
      age: "78",
      district: "Sha Tin",
      category: "Registered nurse",
      care: "Wound care, Blood glucose monitoring",
      background: "Diabetes · recent discharge",
      status: "Under review",
      color: "peach",
      clinicalReviewed: false,
      approved: false,
      original:
        "我媽媽78歲，最近出院，患有糖尿病，腳部有傷口。想搵護士處理傷口及監察血糖。住沙田，希望星期一三五早上九點，每次一小時，先安排兩星期。",
    },
    {
      ...base,
      id: "HK-0023",
      clientId: "C-0023",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      name: "Mr. Chan",
      age: "82",
      district: "Kowloon City",
      category: "Registered nurse",
      care: "Wound care",
      status: "Awaiting providers",
      color: "blue",
      original:
        "My father, Mr. Chan, 82, needs wound care in Kowloon City. Weekdays, 9–10 am for two weeks. Existing care instructions provided.",
      applications: [
        {
          providerId: "P-002",
          appliedAt: now,
          available: true,
          status: "Pending",
        },
      ],
    },
    {
      ...base,
      id: "HK-0022",
      clientId: "C-0022",
      name: "Mrs. Lee",
      age: "74",
      district: "Central & Western",
      category: "Enrolled nurse",
      care: "Blood pressure monitoring",
      status: "Service active",
      color: "lavender",
      providerId: "P-003",
      original:
        "Mrs. Lee, age 74, requires blood pressure monitoring according to her approved instructions. Central, weekdays at 11 am for two weeks.",
      time: "11:00–12:00",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    {
      ...base,
      id: "HK-0021",
      clientId: "C-0021",
      name: "Mr. Ho",
      age: "76",
      district: "Sha Tin",
      category: "Care companion",
      care: "Appointment accompaniment",
      status: "Provider confirmed",
      color: "green",
      providerId: "P-004",
      original:
        "My father needs someone to accompany him to an appointment in Sha Tin this week. No clinical care required.",
      time: "14:00–15:00",
    },
    {
      ...base,
      id: "HK-0020",
      clientId: "C-0020",
      name: "Mrs. Cheung",
      age: "81",
      district: "Tai Po",
      category: "Registered nurse",
      care: "Wound care",
      status: "Service active",
      color: "rose",
      providerId: "P-005",
      original:
        "Please arrange the confirmed wound-care visits for Mrs. Cheung in Tai Po at 15:30, Monday to Friday.",
      time: "15:30–16:30",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    {
      ...base,
      id: "HK-0019",
      clientId: "C-0019",
      name: "Mr. Lam",
      age: "69",
      district: "Wan Chai",
      category: "Needs review",
      care: "Blood pressure monitoring",
      status: "Information required",
      color: "sand",
      duration: "",
      contact: "",
      clinicalReviewed: false,
      approved: false,
      original: "我爸爸69歲住灣仔，想搵人上門量血壓，時間再傾。",
    },
    {
      ...base,
      id: "HK-0018",
      clientId: "C-0018",
      name: "Mrs. Yip",
      age: "72",
      district: "Kowloon City",
      category: "Care companion",
      care: "Appointment accompaniment",
      status: "Completed",
      color: "blue",
      providerId: "P-004",
      original: "Accompaniment to follow-up appointment. Service completed.",
    },
  ];
  const visits: Visit[] = dates.slice(0, 5).flatMap((day, i) => [
    {
      id: `V-${i}-a`,
      caseId: "HK-0023",
      date: day,
      time: "09:00",
      duration: 60,
      tasks: "Wound care",
      status: "Proposed" as const,
      version: 1,
      instructionsConfirmed: true,
      reminder: "Not scheduled" as const,
    },
    {
      id: `V-${i}-b`,
      caseId: "HK-0022",
      date: day,
      time: "11:00",
      duration: 45,
      tasks: "Blood pressure monitoring",
      providerId: "P-003",
      status: "Confirmed" as const,
      version: 1,
      instructionsConfirmed: true,
      reminder: "Scheduled" as const,
    },
    ...(i % 2 === 0
      ? [
          {
            id: `V-${i}-c`,
            caseId: "HK-0021",
            date: day,
            time: "14:00",
            duration: 60,
            tasks: "Appointment accompaniment",
            providerId: "P-004",
            status: "Confirmed" as const,
            version: 1,
            instructionsConfirmed: true,
            reminder: "Scheduled" as const,
          },
        ]
      : []),
    {
      id: `V-${i}-d`,
      caseId: "HK-0020",
      date: day,
      time: "15:30",
      duration: 60,
      tasks: "Wound care",
      providerId: "P-005",
      status: "Confirmed" as const,
      version: 1,
      instructionsConfirmed: true,
      reminder: "Scheduled" as const,
    },
  ]);
  return {
    cases,
    providers,
    visits,
    messages: [],
    activities: [
      {
        id: "A-1",
        text: "A new care enquiry is ready",
        detail: "Mrs. Wong · Sha Tin",
        time: now,
        kind: "case",
      },
      {
        id: "A-2",
        text: "Daniel applied for a case",
        detail: "HK-0023 · Wound care",
        time: new Date(Date.now() - 24 * 60000).toISOString(),
        kind: "provider",
      },
      {
        id: "A-3",
        text: "Care schedule confirmed",
        detail: "Mrs. Lee · Weekday visits",
        time: new Date(Date.now() - 52 * 60000).toISOString(),
        kind: "schedule",
      },
    ],
  };
}
const STORAGE_KEY = "kindred-care-prototype-v1";
export function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (
        Array.isArray(data.cases) &&
        Array.isArray(data.providers) &&
        Array.isArray(data.visits) &&
        Array.isArray(data.activities) &&
        Array.isArray(data.messages)
      )
        return data;
    }
  } catch {
    /* Recover from unavailable or corrupted browser storage. */
  }
  return createSeed();
}
export function persistStore(data: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
