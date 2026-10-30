// Explicitly run when refreshing the public source; never part of offline tests.
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { HOLIDAY_CATALOG } from "../server/catalog/holidays.mjs";
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const sources = [];
const checked = [];
for (const year of [2026, 2027]) {
  const url = `https://www.gov.hk/en/about/abouthk/holiday/${year}.htm`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Holiday source HTTP ${response.status}`);
  const html = await response.text();
  const dates = [
    ...html.matchAll(
      /<td[^>]*class="date"[^>]*>\s*(\d{1,2})\s+([A-Za-z]+)\s*<\/td>/g,
    ),
  ]
    .map(
      ([, day, month]) =>
        `${year}-${String(months.indexOf(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`,
    )
    .sort();
  const expected = HOLIDAY_CATALOG.filter((h) => h.year === year)
    .map((h) => h.date)
    .sort();
  if (JSON.stringify(dates) !== JSON.stringify(expected))
    throw new Error(
      `Official ${year} dates differ from catalogue; review before updating`,
    );
  const fetched_at = new Date().toISOString();
  checked.push(
    ...HOLIDAY_CATALOG.filter((h) => h.year === year).map((h) => ({
      ...h,
      fetched_at,
      verified_source_url: url,
    })),
  );
  sources.push({
    url,
    fetched_at,
    sha256: createHash("sha256").update(html).digest("hex"),
    dates,
  });
}
await writeFile(
  new URL("../server/catalog/holidays.mjs", import.meta.url),
  `// Appendix A dates independently checked against gov.hk. Refresh: node scripts/verify-holidays.mjs\nexport const HOLIDAY_CATALOG = ${JSON.stringify(checked, null, 2)};\n`,
);
await writeFile(
  new URL("../docs/HOLIDAY_SOURCE_CHECK.json", import.meta.url),
  JSON.stringify({ sources }, null, 2) + "\n",
);
console.log(
  `Verified ${checked.length} official holiday dates against gov.hk (2026–2027).`,
);
