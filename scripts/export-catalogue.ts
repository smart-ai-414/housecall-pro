import { readFileSync, writeFileSync } from "node:fs";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

const API_KEY = process.env.HOUSECALL_PRO_API_KEY ?? "";
const BASE_URL =
  process.env.HOUSECALL_PRO_API_BASE_URL ?? "https://api.housecallpro.com";

const REQUEST_SPACING_MS = 120;
const PAGE_SIZE = 50;

function numericArg(flag: string, fallback: number): number {
  const prefix = `${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const parsed = Number.parseInt(match.slice(prefix.length), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stringArg(flag: string, fallback: string): string {
  const prefix = `${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const ESTIMATES_TO_SCAN = numericArg("--estimates", 150);
const JOBS_TO_SCAN = numericArg("--jobs", 150);
const OUTPUT_PATH = stringArg("--out", "catalogue-export.json");
const REPARSE_ONLY = process.argv.includes("--reparse");

const SQUARE_FOOTAGE_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*sq\.?\s*ft\.?/i,
  /(\d+(?:\.\d+)?)\s*sqft/i,
  /(\d+(?:\.\d+)?)\s*s\.?f\.?(?![a-z])/i,
];

const AMBIGUOUS_LEADING_NUMBER = /^(\d+(?:\.\d+)?)\s+glass\s+replacement/i;

interface LineItemRecord {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  kind?: string | null;
  quantity?: number | null;
  service_item_id?: string | null;
  service_item_type?: string | null;
  unit_of_measure?: string | null;
}

interface CatalogueEntry {
  serviceItemId: string;
  name: string;
  kind: string | null;
  serviceItemType: string | null;
  unitOfMeasure: string | null;
  squareFootageBand: number | null;
  unconfirmedBandGuess: number | null;
  timesSeen: number;
  seenOn: { estimates: number; jobs: number };
  namesObserved?: { name: string; count: number }[];
  namesDisagreeOnBand?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function joinUrl(path: string): string {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const suffix = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/${suffix}`;
}

let requestCount = 0;

async function getJson<T>(path: string): Promise<T | null> {
  await delay(REQUEST_SPACING_MS);
  requestCount += 1;

  const response = await fetch(joinUrl(path), {
    headers: {
      Authorization: `Token ${API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function unwrapList(
  body: unknown,
  namedKey: string,
): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (typeof body !== "object" || body === null) return [];

  const record = body as Record<string, unknown>;

  for (const key of [namedKey, "data", "items"]) {
    const value = record[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }

  return [];
}

function squareFootageFromName(name: string): number | null {
  for (const pattern of SQUARE_FOOTAGE_PATTERNS) {
    const match = pattern.exec(name);
    if (match) return Number.parseFloat(match[1]);
  }
  return null;
}

const SERVICE_ITEM_ID_PREFIX = "olit_";
const MINIMUM_BAND_NAME_SHARE = 0.2;

function isBandableServiceItem(entry: CatalogueEntry): boolean {
  return entry.serviceItemId.startsWith(SERVICE_ITEM_ID_PREFIX);
}

function applyObservedNames(
  entry: CatalogueEntry,
  ranked: { name: string; count: number }[],
): void {
  entry.name = ranked[0].name;
  entry.namesObserved = ranked;

  if (!isBandableServiceItem(entry)) {
    entry.squareFootageBand = null;
    entry.unconfirmedBandGuess = null;
    entry.namesDisagreeOnBand = false;
    return;
  }

  const totalObservations = ranked.reduce(
    (sum, observed) => sum + observed.count,
    0,
  );
  const weightedBands = new Map<number, number>();

  for (const observed of ranked) {
    const band = squareFootageFromName(observed.name);
    if (band === null) continue;
    weightedBands.set(band, (weightedBands.get(band) ?? 0) + observed.count);
  }

  const bestBand = [...weightedBands.entries()].sort(
    (a, b) => b[1] - a[1] || a[0] - b[0],
  )[0];

  const wellSupported =
    bestBand !== undefined &&
    bestBand[1] / totalObservations >= MINIMUM_BAND_NAME_SHARE;

  entry.namesDisagreeOnBand = weightedBands.size > 1;
  entry.squareFootageBand = wellSupported ? bestBand[0] : null;
  entry.unconfirmedBandGuess = wellSupported
    ? null
    : looksLikeAnUnlabelledBand(ranked[0].name);
}

function looksLikeAnUnlabelledBand(name: string): number | null {
  const match = AMBIGUOUS_LEADING_NUMBER.exec(name.trim());
  return match ? Number.parseFloat(match[1]) : null;
}

const catalogue = new Map<string, CatalogueEntry>();
const observedNames = new Map<string, Map<string, number>>();

function noteObservedName(serviceItemId: string, name: string): void {
  const counts = observedNames.get(serviceItemId) ?? new Map<string, number>();
  counts.set(name, (counts.get(name) ?? 0) + 1);
  observedNames.set(serviceItemId, counts);
}

function absorb(item: LineItemRecord, source: "estimates" | "jobs"): void {
  const serviceItemId = item.service_item_id ?? "";
  const name = (item.name ?? "").trim();

  if (serviceItemId === "" || name === "") return;

  noteObservedName(serviceItemId, name);

  const existing = catalogue.get(serviceItemId);

  if (existing) {
    existing.timesSeen += 1;
    existing.seenOn[source] += 1;
    return;
  }

  catalogue.set(serviceItemId, {
    serviceItemId,
    name,
    kind: item.kind ?? null,
    serviceItemType: item.service_item_type ?? null,
    unitOfMeasure: item.unit_of_measure ?? null,
    squareFootageBand: squareFootageFromName(name),
    unconfirmedBandGuess: looksLikeAnUnlabelledBand(name),
    timesSeen: 1,
    seenOn: {
      estimates: source === "estimates" ? 1 : 0,
      jobs: source === "jobs" ? 1 : 0,
    },
  });
}

async function collectPagedIds(
  resource: "estimates" | "jobs",
  limit: number,
): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;

  while (ids.length < limit) {
    const body = await getJson<Record<string, unknown>>(
      `${resource}?page=${page}&page_size=${PAGE_SIZE}`,
    );

    const records = unwrapList(body, resource);
    if (records.length === 0) break;

    for (const record of records) {
      const id = record["id"];
      if (typeof id === "string") ids.push(id);
      if (ids.length >= limit) break;
    }

    const totalPages = Number(
      (body as Record<string, unknown> | null)?.["total_pages"] ?? 0,
    );
    if (page >= totalPages) break;

    page += 1;
  }

  return ids;
}

async function scanEstimates(limit: number): Promise<void> {
  const ids = await collectPagedIds("estimates", limit);
  console.log(`  scanning ${ids.length} estimates`);

  let scanned = 0;

  for (const estimateId of ids) {
    const detail = await getJson<Record<string, unknown>>(
      `estimates/${estimateId}`,
    );

    const options = unwrapList(detail?.["options"], "options");

    for (const option of options) {
      const optionId = option["id"];
      if (typeof optionId !== "string") continue;

      const lineItems = await getJson<unknown>(
        `estimates/${estimateId}/options/${optionId}/line_items`,
      );

      for (const item of unwrapList(lineItems, "line_items")) {
        absorb(item as LineItemRecord, "estimates");
      }
    }

    scanned += 1;
    if (scanned % 25 === 0) {
      console.log(
        `    ${scanned}/${ids.length} estimates, ${catalogue.size} distinct items`,
      );
    }
  }
}

async function scanJobs(limit: number): Promise<void> {
  const ids = await collectPagedIds("jobs", limit);
  console.log(`  scanning ${ids.length} jobs`);

  let scanned = 0;

  for (const jobId of ids) {
    const lineItems = await getJson<unknown>(`jobs/${jobId}/line_items`);

    for (const item of unwrapList(lineItems, "line_items")) {
      absorb(item as LineItemRecord, "jobs");
    }

    scanned += 1;
    if (scanned % 25 === 0) {
      console.log(
        `    ${scanned}/${ids.length} jobs, ${catalogue.size} distinct items`,
      );
    }
  }
}

type CatalogueFamily =
  "Residential" | "Commercial storefront" | "Sliding door" | "Other";

function familyOf(name: string): CatalogueFamily {
  if (/storefront|commercial/i.test(name)) return "Commercial storefront";
  if (/sliding\s*door/i.test(name)) return "Sliding door";
  if (/residential/i.test(name)) return "Residential";
  return "Other";
}

function familyOfEntry(entry: CatalogueEntry): CatalogueFamily {
  const weights = new Map<CatalogueFamily, number>();

  for (const observed of entry.namesObserved ?? [
    { name: entry.name, count: entry.timesSeen },
  ]) {
    const family = familyOf(observed.name);
    if (family === "Other") continue;
    weights.set(family, (weights.get(family) ?? 0) + observed.count);
  }

  const best = [...weights.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "Other";
}

function describeBandTolerance(entries: CatalogueEntry[]): void {
  const families = new Map<CatalogueFamily, number[]>();

  for (const entry of entries) {
    if (entry.squareFootageBand === null) continue;
    const family = familyOfEntry(entry);
    families.set(family, [
      ...(families.get(family) ?? []),
      entry.squareFootageBand,
    ]);
  }

  console.log(
    "  Bands ladder separately per family, so tolerance is per family too.",
  );
  console.log(
    "  A residential photo estimate is never matched against a storefront band.",
  );
  console.log("");

  for (const [family, rawBands] of families) {
    const bands = [...new Set(rawBands)].sort((a, b) => a - b);

    if (bands.length < 2) {
      console.log(
        `  ${family}: bands ${bands.join(", ") || "none"} — too few to derive a tolerance`,
      );
      continue;
    }

    const tightest = Math.min(
      ...bands
        .slice(0, -1)
        .map((lower, index) => Math.sqrt(bands[index + 1] / lower) - 1),
    );

    console.log(
      `  ${family}: bands ${bands.join(", ")} — tightest per-axis tolerance ${(tightest * 100).toFixed(1)}%`,
    );
  }

  console.log("");
  console.log(
    "  Those percentages are the accuracy the vision step must hit to land in",
  );
  console.log("  the right band, per family.");
}

async function main(): Promise<void> {
  console.log("Housecall Pro catalogue export");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("");
  console.log(
    "There is no price book endpoint on this key, so the catalogue is recovered",
  );
  console.log(
    "from service_item_id references on historical estimate and job line items.",
  );
  console.log("");

  if (REPARSE_ONLY) {
    const previous = JSON.parse(readFileSync(OUTPUT_PATH, "utf8")) as {
      allServiceItems?: CatalogueEntry[];
    };

    for (const entry of previous.allServiceItems ?? []) {
      catalogue.set(entry.serviceItemId, { ...entry });

      for (const observed of entry.namesObserved ?? [
        { name: entry.name, count: entry.timesSeen },
      ]) {
        const counts =
          observedNames.get(entry.serviceItemId) ?? new Map<string, number>();
        counts.set(observed.name, observed.count);
        observedNames.set(entry.serviceItemId, counts);
      }
    }

    console.log(
      `  Re-parsing ${catalogue.size} items from ${OUTPUT_PATH}. No API calls.`,
    );
  } else {
    if (API_KEY === "") {
      console.error(
        "HOUSECALL_PRO_API_KEY is not set in .env. Nothing to export.",
      );
      process.exit(1);
    }

    await scanEstimates(ESTIMATES_TO_SCAN);
    await scanJobs(JOBS_TO_SCAN);
  }

  for (const entry of catalogue.values()) {
    const counts = observedNames.get(entry.serviceItemId);
    if (!counts) continue;

    applyObservedNames(
      entry,
      [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    );
  }

  const entries = [...catalogue.values()].sort((a, b) => {
    if (a.squareFootageBand !== null && b.squareFootageBand !== null) {
      return a.squareFootageBand - b.squareFootageBand;
    }
    if (a.squareFootageBand !== null) return -1;
    if (b.squareFootageBand !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  const banded = entries.filter((entry) => entry.squareFootageBand !== null);
  const needsHumanRuling = entries.filter(
    (entry) =>
      entry.squareFootageBand === null && entry.unconfirmedBandGuess !== null,
  );
  const renamed = entries.filter(
    (entry) => (entry.namesObserved?.length ?? 0) > 1,
  );

  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        method:
          "Recovered from service_item_id on historical line items. No price book endpoint exists on this API key.",
        note: "Identifiers and names only. Prices live in the Housecall Pro price book and are deliberately not recorded here.",
        estimatesScanned: ESTIMATES_TO_SCAN,
        jobsScanned: JOBS_TO_SCAN,
        distinctServiceItems: entries.length,
        squareFootageBandedItems: banded.length,
        allServiceItems: entries,
        squareFootageBanded: banded,
        bandNeedsHumanRuling: needsHumanRuling,
        seenUnderMultipleNames: renamed,
        bandConflicts: entries.filter((entry) => entry.namesDisagreeOnBand),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("");
  console.log(`  ${requestCount} API requests made`);
  console.log(`  ${entries.length} distinct service items recovered`);
  console.log(
    `  ${renamed.length} appear under more than one name (line item names are editable)`,
  );
  console.log(`  ${banded.length} carry a square-footage band in the name`);
  console.log(`  Wrote ${OUTPUT_PATH} (no price fields recorded)`);
  console.log("");

  describeBandTolerance(banded);

  console.log("");
  console.log("Square-footage banded items:");
  for (const entry of banded) {
    console.log(
      `  ${String(entry.squareFootageBand).padStart(5)} sqft  ${entry.serviceItemId}  ${entry.name}`,
    );
  }

  if (needsHumanRuling.length > 0) {
    console.log("");
    console.log(
      "Names that start with a bare number — is that a square footage?",
    );
    console.log(
      "A person must rule on these before they can be matched against:",
    );
    for (const entry of needsHumanRuling) {
      console.log(
        `  ${String(entry.unconfirmedBandGuess).padStart(5)} ?     ${entry.serviceItemId}  ${entry.name}`,
      );
    }
  }
}

main().catch((error: unknown) => {
  console.error("Catalogue export crashed:", error);
  process.exit(1);
});
