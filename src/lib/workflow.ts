import type { CareCase, Category, Provider, Visit } from "../types";

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DISTRICTS = [
  "Sha Tin",
  "Kowloon City",
  "Central & Western",
  "Wan Chai",
  "Eastern",
  "Southern",
  "Yau Tsim Mong",
  "Sham Shui Po",
  "Wong Tai Sin",
  "Kwun Tong",
  "Kwai Tsing",
  "Tsuen Wan",
  "Tuen Mun",
  "Yuen Long",
  "North",
  "Tai Po",
  "Sai Kung",
  "Islands",
];
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const localDate = (date: string) => new Date(`${date}T12:00:00`);
export const shortDate = (date: string, locale = "en-GB") =>
  localDate(date).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
export const weekDates = (anchor = today()) => {
  const d = localDate(anchor);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return WEEK_DAYS.map((_, i) => {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  });
};
export const uid = () => crypto.randomUUID();
export const initials = (name: string) =>
  name
    .replace(/^(Mrs?\.?|Ms\.?|Dr\.?)\s*/i, "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Inspectable navigation rules, independent of any language model. These are
// prototype suggestions only; a qualified reviewer must confirm clinical scope.
export function servicePathway(text: string): {
  category: Category;
  reason: string;
  urgent: boolean;
} {
  const urgent =
    /chest pain|difficulty breathing|unconscious|胸痛|呼吸困難|昏迷/i.test(
      text,
    );
  if (urgent)
    return {
      category: "Needs review",
      reason:
        "Potentially urgent symptoms. Contact Hong Kong emergency services on 999 if immediate assistance is needed. This form is not monitored for emergencies.",
      urgent: true,
    };
  if (/TPN|tracheostomy|ventilator|氣管造口|呼吸機|靜脈/i.test(text))
    return {
      category: "Needs review",
      reason:
        "Complex clinical needs require assessment by a qualified professional.",
      urgent: false,
    };
  if (
    /wound|dressing|glucose|diabet|insulin|catheter|blood pressure|傷口|血糖|糖尿|導尿|血壓|護士|nurs/i.test(
      text,
    )
  )
    return {
      category: "Needs review",
      reason:
        "Clinical care identified. A qualified reviewer must confirm RN or EN scope and competencies.",
      urgent: false,
    };
  if (/accompan|appointment|escort|陪診|覆診|陪同/i.test(text))
    return {
      category: "Care companion",
      reason:
        "Non-clinical accompaniment may be suitable. Staff must confirm that no clinical care is needed.",
      urgent: false,
    };
  return {
    category: "Needs review",
    reason: "There is not enough information to suggest a service pathway.",
    urgent: false,
  };
}

export function extractEnquiry(text: string) {
  const age =
    text.match(
      /(?:aged?\s*|年齡\s*)?(\d{1,3})\s*(?:years?\s*old|歲|y\/?o)/i,
    )?.[1] ?? "";
  const districtNames: Record<string, string> = {
    沙田: "Sha Tin",
    九龍城: "Kowloon City",
    中西區: "Central & Western",
    中環: "Central & Western",
    灣仔: "Wan Chai",
    東區: "Eastern",
    南區: "Southern",
    油尖旺: "Yau Tsim Mong",
    深水埗: "Sham Shui Po",
    黃大仙: "Wong Tai Sin",
    觀塘: "Kwun Tong",
    葵青: "Kwai Tsing",
    荃灣: "Tsuen Wan",
    屯門: "Tuen Mun",
    元朗: "Yuen Long",
    北區: "North",
    大埔: "Tai Po",
    西貢: "Sai Kung",
    離島: "Islands",
  };
  const district =
    DISTRICTS.find((d) => text.toLowerCase().includes(d.toLowerCase())) ??
    Object.entries(districtNames).find(([cn]) => text.includes(cn))?.[1] ??
    "";
  const tasks: string[] = [];
  if (/wound|dressing|傷口/i.test(text)) tasks.push("Wound care");
  if (/glucose|blood sugar|血糖/i.test(text))
    tasks.push("Blood glucose monitoring");
  if (/blood pressure|血壓/i.test(text))
    tasks.push("Blood pressure monitoring");
  if (/accompan|appointment\s+companion|escort|陪診|陪同|覆診/i.test(text))
    tasks.push("Appointment accompaniment");
  if (/catheter|導尿/i.test(text)) tasks.push("Catheter care");
  const medical = [];
  if (/diabet|糖尿/i.test(text)) medical.push("Diabetes");
  if (/hypertension|高血壓/i.test(text)) medical.push("Hypertension");
  if (/discharg|出院/i.test(text)) medical.push("Recent hospital discharge");
  let days: string[] = [];
  if (
    /monday\s*(?:to|-|through)\s*friday|weekdays|星期一至五|週一至五/i.test(
      text,
    )
  )
    days = WEEK_DAYS.slice(0, 5);
  else if (/every day|daily|每日|每天/i.test(text)) days = [...WEEK_DAYS];
  else
    WEEK_DAYS.forEach((d, i) => {
      if (
        new RegExp(
          `${["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][i]}|星期${["一", "二", "三", "四", "五", "六", "日"][i]}|週${["一", "二", "三", "四", "五", "六", "日"][i]}`,
          "i",
        ).test(text)
      )
        days.push(d);
    });
  const explicitTime = text.match(
    /\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:–|-|to|至)\s*([01]?\d|2[0-3]):([0-5]\d)\b/,
  );
  const time = explicitTime
    ? `${explicitTime[1].padStart(2, "0")}:${explicitTime[2]}–${explicitTime[3].padStart(2, "0")}:${explicitTime[4]}`
    : /afternoon|下午/i.test(text)
      ? "Afternoon · time to confirm"
      : /morning|朝早|早上|上午/i.test(text)
        ? "Morning · time to confirm"
        : /evening|晚上/i.test(text)
          ? "Evening · time to confirm"
          : "";
  const name =
    text.match(
      /\b((?:Mrs?\.?|Ms\.?|Dr\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    )?.[1] ?? "";
  const duration =
    text.match(/\b(\d+)\s*(weeks?|days?|months?)\b/i)?.[0] ??
    text.match(/\d+\s*(?:星期|個月|天)/)?.[0] ??
    "";
  return {
    name,
    age,
    district,
    care: tasks.join(", "),
    background: medical.join(", "),
    days,
    time,
    duration,
    category: servicePathway(text).category,
    contact: "",
    budget: "",
    notes: "",
  };
}

export function missingFields(
  c: Pick<
    CareCase,
    | "name"
    | "district"
    | "care"
    | "time"
    | "days"
    | "duration"
    | "contact"
    | "category"
  >,
) {
  return [
    !c.name && "Patient name",
    !c.district && "Service district",
    !c.care && "Care requirements",
    !c.time && "Visit time",
    !c.days.length && "Service days",
    !c.duration && "Service duration",
    !c.contact && "Contact details",
    c.category === "Needs review" && "Professional requirements",
  ].filter(Boolean) as string[];
}
export function canPublish(c: CareCase) {
  return !!(
    c.name &&
    c.district &&
    c.care &&
    c.time &&
    c.days.length &&
    c.duration &&
    c.consent &&
    c.clinicalReviewed &&
    c.familyAgreed &&
    c.priceConfirmed &&
    c.approved &&
    c.category !== "Needs review"
  );
}
export function providerEligible(c: CareCase, p: Provider) {
  return (
    p.verified &&
    p.optIn &&
    p.category === c.category &&
    p.districts.includes(c.district) &&
    c.care.split(",").every((task) => p.skills.includes(task.trim()))
  );
}
export function overlaps(
  a: Pick<Visit, "date" | "time" | "duration">,
  b: Pick<Visit, "date" | "time" | "duration">,
) {
  const minutes = (s: string) =>
    Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]);
  return (
    a.date === b.date &&
    minutes(a.time) < minutes(b.time) + b.duration &&
    minutes(b.time) < minutes(a.time) + a.duration
  );
}
export function scheduleConflict(
  candidate: Pick<
    Visit,
    "date" | "time" | "duration" | "providerId" | "caseId"
  >,
  visits: Visit[],
  excludeId?: string,
) {
  return visits.some(
    (v) =>
      v.id !== excludeId &&
      v.status !== "Completed" &&
      (v.caseId === candidate.caseId ||
        (!!candidate.providerId && v.providerId === candidate.providerId)) &&
      overlaps(candidate, v),
  );
}
export function broadcastText(c: CareCase) {
  return `HOME CARE OPPORTUNITY\n\nCase ${c.id}\nDistrict: ${c.district}\nService: ${c.care}\nProvider: ${c.category}\nPreferred days: ${c.days.join(", ")}\nTime: ${c.time}\nDuration: ${c.duration || "To be confirmed"}\nRemuneration: ${c.budget || "To be confirmed"}\n\nApply via the provider portal. Availability and eligibility must be confirmed by the care team.\n\nNo patient-identifying information is included in this broadcast.`;
}
export function csvCell(value: unknown) {
  return `"${String(value ?? "")
    .replaceAll('"', '""')
    .replace(/^[=+@-]/, "'$&")}"`;
}
