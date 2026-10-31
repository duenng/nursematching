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
export interface ServiceItemDefinition {
  id: string;
  category: "A" | "B" | "C";
  label: string;
  zh: string;
  doctorOrderRequired?: boolean;
  tubeOnly?: boolean;
}
export const SERVICE_ITEMS: ServiceItemDefinition[] = [
  {
    id: "vitals",
    category: "A",
    label: "Vital signs monitoring",
    zh: "檢測生命表徵（血壓、脈搏、體溫、血氧）",
  },
  {
    id: "glucose",
    category: "A",
    label: "Blood glucose monitoring",
    zh: "血糖監測（篤手指度血糖）",
  },
  {
    id: "simple-wound",
    category: "A",
    label: "Simple wound care",
    zh: "簡單傷口護理（清洗及換敷料）",
  },
  {
    id: "stoma",
    category: "A",
    label: "Stoma care",
    zh: "造口護理（清潔及換袋）",
  },
  {
    id: "catheter-care",
    category: "A",
    label: "Existing urinary catheter daily care",
    zh: "現有尿喉日常護理（清潔、倒尿袋）",
  },
  {
    id: "tube-feeding",
    category: "A",
    label: "Tube feeding through an existing tube",
    zh: "經現有喉管管道餵食",
  },
  {
    id: "suction",
    category: "A",
    label: "Suction / chest physiotherapy",
    zh: "抽痰／拍痰（可按需要 PRN）",
  },
  {
    id: "tracheostomy",
    category: "A",
    label: "Tracheostomy care",
    zh: "氣管造口護理",
  },
  {
    id: "peritoneal",
    category: "A",
    label: "Peritoneal dialysis",
    zh: "腹膜透析（洗肚）",
  },
  {
    id: "tpn",
    category: "B",
    label: "TPN / intravenous nutrition",
    zh: "TPN／靜脈營養",
    doctorOrderRequired: true,
  },
  {
    id: "picc",
    category: "B",
    label: "PICC care",
    zh: "PICC 中央靜脈導管護理",
    doctorOrderRequired: true,
  },
  {
    id: "iv",
    category: "B",
    label: "Intravenous injection",
    zh: "靜脈注射",
    doctorOrderRequired: true,
  },
  {
    id: "ng-change",
    category: "B",
    label: "Replace an existing nasogastric tube",
    zh: "更換鼻胃喉（只換現有喉管，不做首次插入）",
    tubeOnly: true,
    doctorOrderRequired: true,
  },
  {
    id: "peg-change",
    category: "B",
    label: "Replace an existing gastrostomy tube",
    zh: "更換胃造口喉（只換現有喉管，不做首次插入）",
    tubeOnly: true,
    doctorOrderRequired: true,
  },
  {
    id: "urinary-change",
    category: "B",
    label: "Replace an existing urinary catheter",
    zh: "更換尿喉（只換現有喉管，不做首次插入）",
    tubeOnly: true,
    doctorOrderRequired: true,
  },
  {
    id: "medication",
    category: "B",
    label: "Medication or injections",
    zh: "藥物或注射（派藥／皮下／肌肉注射）",
    doctorOrderRequired: true,
  },
  {
    id: "complex-wound",
    category: "B",
    label: "Complex wound care",
    zh: "複雜傷口護理",
    doctorOrderRequired: true,
  },
  {
    id: "mobility",
    category: "C",
    label: "Mobility assistance",
    zh: "行動協助（扶抱、轉位、行路）",
  },
  {
    id: "appointment",
    category: "C",
    label: "Appointment accompaniment",
    zh: "陪診",
  },
] as const;
export type ServiceItem = ServiceItemDefinition;
export const RECENT_CONDITIONS = [
  "Serious illness",
  "Fall / dizziness / loss of balance",
  "Eating or swallowing difficulty",
  "Pain",
  "Pressure sore / surgical wound",
  "None of the above",
] as const;
export const HONG_KONG_HOLIDAYS = new Set([
  "2026-01-01",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-04-03",
  "2026-04-04",
  "2026-04-06",
  "2026-04-07",
  "2026-05-01",
  "2026-05-25",
  "2026-06-19",
  "2026-07-01",
  "2026-09-26",
  "2026-10-01",
  "2026-10-19",
  "2026-12-25",
  "2026-12-26",
  "2027-01-01",
  "2027-02-06",
  "2027-02-08",
  "2027-02-09",
  "2027-03-26",
  "2027-03-27",
  "2027-03-29",
  "2027-04-05",
  "2027-05-01",
  "2027-05-13",
  "2027-06-09",
  "2027-07-01",
  "2027-09-16",
  "2027-10-01",
  "2027-10-08",
  "2027-12-25",
  "2027-12-27",
]);
export const DAY_RATE = 305;
export const NIGHT_RATE = 325;
export const NURSE_DAY_RATE = 245;
export const NURSE_NIGHT_RATE = 270;
export const HOLIDAY_SURCHARGE = 30;
export const REMOTE_ALLOWANCE = 150;
export const PACKAGE_HOURS = 30;
export const PACKAGE_PRICE = 8650;
export function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}
export function validateServiceWindow(
  category: CareCase["timeCategory"],
  start: string,
  end: string,
) {
  if (category === "Night 10 hours")
    return start === "22:00" && end === "08:00";
  if (category === "Night 12 hours")
    return start === "22:00" && end === "10:00";
  if (!start || !end) return false;
  return (
    minutes(start) >= 420 &&
    minutes(end) <= 1320 &&
    minutes(start) < minutes(end)
  );
}
export function parsePreferredTimes(value: string) {
  return value
    .split(/[,、\s]+/)
    .filter(Boolean)
    .map((time) => time.trim());
}
export function validPreferredTimes(
  times: string[],
  category: CareCase["timeCategory"],
  start: string,
  end: string,
) {
  return times.every(
    (time) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(time) &&
      (category !== "Day" ||
        (minutes(time) >= minutes(start) && minutes(time) <= minutes(end))),
  );
}
export function isHolidayOrSunday(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 || HONG_KONG_HOLIDAYS.has(date);
}
export function holidayHours(
  date: string,
  category: CareCase["timeCategory"],
  start: string,
  end: string,
) {
  if (category === "Day")
    return isHolidayOrSunday(date)
      ? Math.max(minutes(end) - minutes(start), 240) / 60
      : 0;
  const endDate = new Date(`${date}T12:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const nextDate = endDate.toISOString().slice(0, 10);
  return isHolidayOrSunday(nextDate)
    ? category === "Night 10 hours"
      ? 8
      : 10
    : 0;
}
export function calculateQuote(input: {
  dates: string[];
  category: CareCase["timeCategory"];
  start: string;
  end: string;
}) {
  const category = input.category ?? "Day";
  if (!validateServiceWindow(category, input.start, input.end))
    throw new Error("Invalid service window");
  const lines = input.dates.map((date) => {
    const hours =
      category === "Day"
        ? Math.max((minutes(input.end) - minutes(input.start)) / 60, 4)
        : category === "Night 10 hours"
          ? 10
          : 12;
    const rate = category === "Day" ? DAY_RATE : NIGHT_RATE;
    const holiday = holidayHours(date, category, input.start, input.end);
    const baseAmount = hours * rate;
    const surcharge = holiday * HOLIDAY_SURCHARGE;
    return {
      date,
      category,
      startTime: input.start,
      endTime: input.end,
      billableHours: hours,
      hourlyRate: rate,
      baseAmount,
      holidayHours: holiday,
      holidaySurcharge: surcharge,
      subtotal: baseAmount + surcharge,
    };
  });
  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.subtotal, 0),
    holidayHours: lines.reduce((sum, line) => sum + line.holidayHours, 0),
    holidaySurcharge: lines.reduce(
      (sum, line) => sum + line.holidaySurcharge,
      0,
    ),
  };
}
export function remoteAreaTier(
  district: string,
  building: string,
): "A" | "B" | "C" | "unmatched" {
  const value = `${district} ${building}`.toLowerCase();
  if (
    /長洲|cheung chau|坪洲|peng chau|南丫|lamma|塔門|tap mun|吉澳|蓮麻坑|鹿頸|大澳|梅窩|北潭涌|白泥|龍鼓灘/.test(
      value,
    )
  )
    return "A";
  if (
    /打鼓嶺|坪輋|落馬洲|新田|米埔|白沙灣|相思灣|大網仔|大美督|汀角|林村|八鄉|石崗|流浮山|掃管笏|石澳|紅山半島|愉景灣/.test(
      value,
    )
  )
    return "B";
  if (building.trim()) return "C";
  return "unmatched";
}
export function nursePay(
  category: CareCase["timeCategory"],
  billableHours: number,
  remoteTier: string,
) {
  const base =
    category === "Day"
      ? Math.max(billableHours, 4) * NURSE_DAY_RATE
      : (category === "Night 10 hours" ? 10 : 12) * NURSE_NIGHT_RATE;
  return (
    base + (remoteTier === "A" || remoteTier === "B" ? REMOTE_ALLOWANCE : 0)
  );
}
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
