import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

import { TEST_RECORD_PREFIX } from "../core/config/branding";

const API_KEY = process.env.HOUSECALL_PRO_API_KEY ?? "";
const CONFIGURED_BASE_URL =
  process.env.HOUSECALL_PRO_API_BASE_URL ?? "https://api.housecallpro.com";

function argValue(flag: string, fallback: string): string {
  const prefix = `${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const WRITES_ENABLED = process.argv.includes("--write");
const DISCOVER_ONLY = process.argv.includes("--discover");
const EXISTING_ESTIMATE_ID = argValue("--estimate-id", "");
const REUSE_CUSTOMER_ID = argValue("--customer-id", "");
const CATALOGUE_OUTPUT_PATH = argValue("--out", "catalogue-export.json");
const CREATED_RECORDS_PATH = argValue(
  "--created",
  "smoke-test-created-records.json",
);

const CATALOGUE_PATH_CANDIDATES = [
  "price_book/services",
  "price_book/service_items",
  "price_book/materials",
  "price_book/items",
  "price_book/categories",
  "price_book",
  "service_items",
  "services",
  "catalog/services",
  "catalog",
  "line_items",
  "materials",
  "products",
] as const;

const DISCOVERY_PATHS = [
  "customers",
  "jobs",
  "estimates",
  "invoices",
  "employees",
  "company",
  "webhooks",
  "applications",
  "price_book",
  "price_book/services",
  "price_book/service_items",
  "price_book/materials",
  "price_book/categories",
  "service_items",
  "services",
  "catalog",
  "materials",
  "products",
  "job_types",
  "tags",
  "lead_sources",
] as const;

const CUSTOMER_PATH_CANDIDATES = [
  "customers",
  "pro/v1/customers",
  "v1/customers",
] as const;

const ESTIMATE_PATH_CANDIDATES = [
  "estimates",
  "pro/v1/estimates",
  "v1/estimates",
] as const;

const WEBHOOK_PATH_CANDIDATES = [
  "webhooks",
  "pro/v1/webhooks",
  "v1/webhooks",
] as const;

const SQUARE_FOOTAGE_IN_NAME = /(\d+(?:\.\d+)?)\s*sq\.?\s*ft/i;
const GLASS_REPLACEMENT_HINT = /glass\s*replacement/i;

interface ApiCallResult {
  ok: boolean;
  status: number;
  body: unknown;
  rawText: string;
}

interface CatalogueEntry {
  id: string;
  name: string;
  squareFootageBand: number | null;
}

let failures = 0;

interface CreatedRecord {
  kind: string;
  id: string;
  path: string;
}

const createdThisRun: CreatedRecord[] = [];

function readExistingManifest(): CreatedRecord[] {
  if (!existsSync(CREATED_RECORDS_PATH)) return [];

  try {
    const parsed = JSON.parse(readFileSync(CREATED_RECORDS_PATH, "utf8")) as {
      createdRecords?: unknown;
    };

    if (!Array.isArray(parsed.createdRecords)) return [];

    return parsed.createdRecords.filter(
      (record): record is CreatedRecord =>
        typeof record === "object" &&
        record !== null &&
        typeof (record as CreatedRecord).id === "string" &&
        typeof (record as CreatedRecord).path === "string",
    );
  } catch {
    return [];
  }
}

const carriedOverRecords = readExistingManifest();

function outstandingRecords(): CreatedRecord[] {
  const byId = new Map<string, CreatedRecord>();
  for (const record of [...carriedOverRecords, ...createdThisRun]) {
    byId.set(record.id, record);
  }
  return [...byId.values()];
}

function persistManifest(): void {
  writeFileSync(
    CREATED_RECORDS_PATH,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        note: "Every record here still exists in the live account. Customers cannot be deleted through the API — remove those in the Housecall Pro UI.",
        createdRecords: outstandingRecords(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function recordCreated(kind: string, id: string, path: string): void {
  createdThisRun.push({ kind, id, path });
  persistManifest();
}

function heading(text: string): void {
  console.log("");
  console.log(text);
  console.log("-".repeat(text.length));
}

function report(label: string, passed: boolean, detail = ""): void {
  if (!passed) failures += 1;
  console.log(
    `  [${passed ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${trimmedBase}/${trimmedPath}`;
}

async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiCallResult> {
  const response = await fetch(joinUrl(CONFIGURED_BASE_URL, path), {
    method,
    headers: {
      Authorization: `Token ${API_KEY}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await response.text();

  let parsed: unknown = null;
  try {
    parsed = rawText.length > 0 ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  return { ok: response.ok, status: response.status, body: parsed, rawText };
}

function describeEnvelope(body: unknown): string {
  if (Array.isArray(body)) return `array of ${body.length}`;
  if (typeof body === "object" && body !== null) {
    return `keys: ${Object.keys(body).join(", ") || "(none)"}`;
  }
  return typeof body;
}

async function discoverResources(): Promise<void> {
  heading("Resource discovery");
  console.log("  Read-only probe of every plausible top-level resource.");
  console.log("");
  console.log(`  ${"PATH".padEnd(30)} STATUS  SHAPE`);
  console.log(`  ${"-".repeat(30)} ------  -----`);

  for (const path of DISCOVERY_PATHS) {
    const result = await call("GET", path);
    const shape = result.ok ? describeEnvelope(result.body) : "";
    console.log(
      `  ${path.padEnd(30)} ${String(result.status).padEnd(7)} ${shape}`,
    );
  }

  console.log("");
  console.log("  Anything returning 200 is reachable with this key.");
  console.log(
    "  404 means the path is wrong; 403 means the plan tier blocks it.",
  );
}

async function resolveWorkingPath(
  candidates: readonly string[],
): Promise<{ path: string; result: ApiCallResult } | null> {
  for (const candidate of candidates) {
    const result = await call("GET", candidate);
    console.log(`      GET ${candidate} -> ${result.status}`);
    if (result.ok) return { path: candidate, result };
  }
  return null;
}

function extractRecords(
  body: unknown,
  keys: readonly string[],
): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];

  if (typeof body === "object" && body !== null) {
    for (const key of keys) {
      const value = (body as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as Record<string, unknown>[];
    }
  }

  return [];
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function squareFootageFromName(name: string): number | null {
  const match = SQUARE_FOOTAGE_IN_NAME.exec(name);
  return match ? Number.parseFloat(match[1]) : null;
}

function describeBandTolerance(entries: CatalogueEntry[]): void {
  const bands = [
    ...new Set(
      entries
        .map((entry) => entry.squareFootageBand)
        .filter((band): band is number => band !== null),
    ),
  ].sort((a, b) => a - b);

  if (bands.length < 2) {
    console.log(
      "  Not enough square-footage bands parsed from names to derive a tolerance.",
    );
    console.log(
      "  Inspect the exported names by hand and record the banding pattern.",
    );
    return;
  }

  console.log(`  Bands found: ${bands.join(", ")}`);
  console.log("");
  console.log("  Band      Width    Max area error   Max per-axis error");

  for (let index = 0; index < bands.length - 1; index += 1) {
    const lower = bands[index];
    const upper = bands[index + 1];
    const areaTolerance = upper / lower - 1;
    const perAxisTolerance = Math.sqrt(upper / lower) - 1;

    console.log(
      `  ${String(lower).padEnd(9)} ${String(upper - lower).padEnd(8)} ` +
        `${(areaTolerance * 100).toFixed(1).padStart(13)}%  ` +
        `${(perAxisTolerance * 100).toFixed(1).padStart(17)}%`,
    );
  }

  const tightest = Math.min(
    ...bands
      .slice(0, -1)
      .map((lower, index) => Math.sqrt(bands[index + 1] / lower) - 1),
  );

  console.log("");
  console.log(
    `  Tightest per-axis dimension tolerance: ${(tightest * 100).toFixed(1)}%`,
  );
  console.log(
    "  That is the accuracy the vision step must hit to land in the right band.",
  );
}

async function testReadCatalogue(): Promise<string | null> {
  heading("Test 1 — read the service catalogue");

  const resolved = await resolveWorkingPath(CATALOGUE_PATH_CANDIDATES);

  if (!resolved) {
    report("catalogue readable", false, "no candidate path returned 200");
    return null;
  }

  report("catalogue readable", true, `path "${resolved.path}"`);
  console.log(`      envelope ${describeEnvelope(resolved.result.body)}`);

  const records = extractRecords(resolved.result.body, [
    "services",
    "data",
    "items",
    "price_book_services",
  ]);

  report(
    "catalogue returned records",
    records.length > 0,
    `${records.length} items`,
  );

  const entries: CatalogueEntry[] = records
    .map((record) => {
      const name = readString(record, "name") || readString(record, "title");
      return {
        id: readString(record, "id") || readString(record, "uuid"),
        name,
        squareFootageBand: squareFootageFromName(name),
      };
    })
    .filter((entry) => entry.id !== "" && entry.name !== "");

  const glassReplacement = entries.filter(
    (entry) =>
      GLASS_REPLACEMENT_HINT.test(entry.name) ||
      entry.squareFootageBand !== null,
  );

  report(
    "glass replacement items located",
    glassReplacement.length > 0,
    `${glassReplacement.length} of ${entries.length}`,
  );

  writeFileSync(
    CATALOGUE_OUTPUT_PATH,
    `${JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        sourcePath: resolved.path,
        note: "Identifiers and names only. Prices live in the Housecall Pro price book and are deliberately not recorded here.",
        allServices: entries,
        glassReplacement,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("");
  console.log(`  Wrote ${CATALOGUE_OUTPUT_PATH} (no price fields recorded).`);
  console.log("");

  describeBandTolerance(glassReplacement);

  return resolved.path;
}

async function testReadCustomers(): Promise<string | null> {
  heading("Test 2 — read customers");

  const resolved = await resolveWorkingPath(CUSTOMER_PATH_CANDIDATES);

  if (!resolved) {
    report("customers readable", false, "no candidate path returned 200");
    return null;
  }

  const records = extractRecords(resolved.result.body, ["customers", "data"]);
  report(
    "customers readable",
    true,
    `path "${resolved.path}", ${records.length} returned`,
  );
  console.log(`      envelope ${describeEnvelope(resolved.result.body)}`);

  return resolved.path;
}

async function testReuseCustomer(
  customersPath: string,
  customerId: string,
): Promise<string | null> {
  heading("Test 3 — reuse an existing test customer");
  console.log("  The API cannot delete customers, so every run reuses one.");
  console.log("");

  const result = await call("GET", `${customersPath}/${customerId}`);

  if (!result.ok) {
    report("customer found", false, `status ${result.status}`);
    return null;
  }

  const record = (result.body ?? {}) as Record<string, unknown>;
  const firstName = readString(record, "first_name");
  const carriesPrefix = firstName.startsWith(TEST_RECORD_PREFIX);

  report(
    "customer found",
    true,
    `${firstName} ${readString(record, "last_name")}`,
  );
  report(
    `customer is a ${TEST_RECORD_PREFIX} record`,
    carriesPrefix,
    carriesPrefix ? "" : "REFUSING — this looks like a real customer",
  );

  if (!carriesPrefix) return null;

  return customerId;
}

async function testCreateCustomer(
  customersPath: string,
): Promise<string | null> {
  heading("Test 3 — create a test customer");
  console.log(
    `  NOTE: the API cannot delete customers. This one is permanent until`,
  );
  console.log("  someone removes it in the Housecall Pro UI. Prefer");
  console.log("  --customer-id=<existing> on repeat runs.");
  console.log("");

  const result = await call("POST", customersPath, {
    first_name: `${TEST_RECORD_PREFIX} Smoke`,
    last_name: "Check",
    mobile_number: "5550100001",
    email: "smoke-check@example.invalid",
    notifications_enabled: false,
    addresses: [
      {
        street: "1 Test Street",
        city: "Testville",
        state: "FL",
        zip: "33101",
      },
    ],
  });

  const id =
    typeof result.body === "object" && result.body !== null
      ? readString(result.body as Record<string, unknown>, "id")
      : "";

  report("customer created", result.ok && id !== "", `status ${result.status}`);

  if (!result.ok) {
    console.log(`      response: ${result.rawText.slice(0, 400)}`);
    return null;
  }

  recordCreated("customer", id, customersPath);
  console.log(`      customer id: ${id}`);

  return id;
}

async function testCreateEstimate(
  estimatesPath: string,
  customerId: string,
): Promise<string | null> {
  heading("Test 4 — create an unsent draft estimate");

  const note = `${TEST_RECORD_PREFIX} Created by scripts/smoke-test-hcp.ts. Safe to delete.`;

  const result = await call("POST", estimatesPath, {
    customer_id: customerId,
    note,
    options: [
      {
        name: `${TEST_RECORD_PREFIX} Option 1`,
        message_from_pro: note,
        line_items: [
          {
            name: `${TEST_RECORD_PREFIX} Placeholder — smoke test`,
            quantity: 1,
            kind: "labor",
            order_index: 0,
          },
        ],
      },
    ],
  });

  const id =
    typeof result.body === "object" && result.body !== null
      ? readString(result.body as Record<string, unknown>, "id")
      : "";

  report("estimate created", result.ok && id !== "", `status ${result.status}`);

  if (!result.ok) {
    console.log(`      response: ${result.rawText.slice(0, 400)}`);
    return null;
  }

  recordCreated("estimate", id, estimatesPath);

  const workStatus =
    typeof result.body === "object" && result.body !== null
      ? readString(result.body as Record<string, unknown>, "work_status")
      : "";

  console.log(`      estimate id: ${id}`);
  console.log(`      work_status: ${workStatus || "(not returned)"}`);
  console.log("      Confirm in the Housecall Pro UI that this is UNSENT.");

  return id;
}

async function testAttachPhoto(
  estimatesPath: string,
  estimateId: string,
): Promise<void> {
  heading("Test 5 — attach a photo to the estimate");

  const onePixelJpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
    "base64",
  );

  const result = await call(
    "POST",
    `${estimatesPath}/${estimateId}/attachments`,
    {
      file_name: "smoke-test.jpg",
      content_type: "image/jpeg",
      data: onePixelJpeg.toString("base64"),
    },
  );

  if (result.ok) {
    report("photo attachment supported", true, `status ${result.status}`);
    console.log("");
    console.log(
      "      This CONTRADICTS the 12 Sep 2026 probe, which saw 404 here.",
    );
    console.log(
      "      Attachments would become the primary path and docs/ARCHITECTURE.md",
    );
    console.log("      would need revisiting.");
    return;
  }

  report(
    "photo attachment unavailable, as expected",
    result.status === 404,
    `status ${result.status}`,
  );
  console.log(
    "      Signed links in the estimate notes are the only path. PUBLIC_APP_URL",
  );
  console.log(
    "      must be set or those links expire before a reviewer opens them.",
  );
}

async function testReadBackEstimate(
  estimatesPath: string,
  estimateId: string,
): Promise<void> {
  heading("Test 6 — read the estimate back (the accuracy loop)");

  const result = await call("GET", `${estimatesPath}/${estimateId}`);

  report("estimate readable by id", result.ok, `status ${result.status}`);

  if (!result.ok) {
    console.log(`      response: ${result.rawText.slice(0, 400)}`);
    return;
  }

  const record = (result.body ?? {}) as Record<string, unknown>;
  const options = extractRecords(record["options"], ["options"]);

  report(
    "options returned on GET",
    options.length > 0,
    `${options.length} options`,
  );

  let lineItemCount = 0;

  for (const option of options) {
    const optionId = readString(option, "id");
    if (optionId === "") continue;

    const nested = await call(
      "GET",
      `${estimatesPath}/${estimateId}/options/${optionId}/line_items`,
    );

    const items = extractRecords(nested.body, ["line_items"]);
    lineItemCount += items.length;

    if (items[0]) {
      console.log(
        `      option ${readString(option, "option_number") || optionId}: ${items.length} line items`,
      );
      console.log(
        `      line item keys: ${Object.keys(items[0]).sort().join(", ")}`,
      );
    }
  }

  report(
    "line items readable under options",
    lineItemCount > 0,
    `${lineItemCount} across ${options.length} option(s)`,
  );

  if (lineItemCount === 0) {
    console.log("");
    console.log(
      "      Without readable line items, reviewer edits cannot be diffed",
    );
    console.log("      and the Phase 2 accuracy criteria are not measurable.");
  }
}

async function probeWebhooks(): Promise<void> {
  heading("Test 7 — webhook management over the API");

  const resolved = await resolveWorkingPath(WEBHOOK_PATH_CANDIDATES);

  if (!resolved) {
    console.log("  [INFO] no webhook management endpoint answered");
    console.log("");
    console.log("      This is not conclusive. Housecall Pro configures");
    console.log("      webhooks in the web UI, so the absence of a management");
    console.log("      endpoint says nothing about whether webhooks fire.");
    console.log("      Check Settings for a webhook or developer section, and");
    console.log(
      "      rely on test 6 for whether reviewer edits are readable.",
    );
    return;
  }

  report("webhook management reachable", true, `path "${resolved.path}"`);
  console.log(`      response: ${resolved.result.rawText.slice(0, 300)}`);
}

async function main(): Promise<void> {
  console.log("Housecall Pro smoke test");
  console.log(`Base URL: ${CONFIGURED_BASE_URL}`);
  console.log(
    `Writes:   ${WRITES_ENABLED ? "ENABLED (live account)" : "disabled (read-only)"}`,
  );

  if (API_KEY === "") {
    console.error("");
    console.error("HOUSECALL_PRO_API_KEY is not set in .env. Nothing to test.");
    process.exit(1);
  }

  if (DISCOVER_ONLY) {
    await discoverResources();
    return;
  }

  await testReadCatalogue();
  const customersPath = await testReadCustomers();

  if (EXISTING_ESTIMATE_ID !== "") {
    const estimatesResolved = await resolveWorkingPath(
      ESTIMATE_PATH_CANDIDATES,
    );
    await testReadBackEstimate(
      estimatesResolved?.path ?? ESTIMATE_PATH_CANDIDATES[0],
      EXISTING_ESTIMATE_ID,
    );
  }

  if (!WRITES_ENABLED) {
    heading("Write tests skipped");
    console.log("  Nothing was created in the live account.");
    console.log(
      "  Re-run with --write to create a test customer and estimate.",
    );
    console.log("  Those writes land in the LIVE Housecall Pro account.");
  } else if (customersPath) {
    const customerId = REUSE_CUSTOMER_ID
      ? await testReuseCustomer(customersPath, REUSE_CUSTOMER_ID)
      : await testCreateCustomer(customersPath);

    if (customerId) {
      const estimatesResolved = await resolveWorkingPath(
        ESTIMATE_PATH_CANDIDATES,
      );
      const estimatesPath =
        estimatesResolved?.path ?? ESTIMATE_PATH_CANDIDATES[0];
      const estimateId = await testCreateEstimate(estimatesPath, customerId);

      if (estimateId) {
        await testAttachPhoto(estimatesPath, estimateId);
        await testReadBackEstimate(estimatesPath, estimateId);
      }
    }
  }

  await probeWebhooks();

  const outstanding = outstandingRecords();

  if (outstanding.length > 0) {
    persistManifest();

    heading("Test records outstanding in the live account");
    for (const record of outstanding) {
      const isNew = createdThisRun.some((entry) => entry.id === record.id);
      console.log(
        `  ${record.kind.padEnd(9)} ${record.id}${isNew ? "  (created this run)" : ""}`,
      );
    }
    console.log("");
    console.log(`  Tracked in ${CREATED_RECORDS_PATH}.`);
    console.log(
      "  npm run hcp:cleanup -- --delete removes the estimates. Customers have",
    );
    console.log(
      "  no DELETE verb and must be removed in the Housecall Pro UI.",
    );
  }

  heading(failures === 0 ? "All checks passed" : `${failures} check(s) failed`);

  console.log("");
  console.log(
    "Next: put the working path prefix into HOUSECALL_PRO_API_BASE_URL in .env",
  );
  console.log("so the paths in modules/housecall-pro resolve without change.");

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
