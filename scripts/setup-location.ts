import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { TEST_RECORD_PREFIX } from "../core/config/branding";
import { encryptSecret, maskSecret } from "../core/security/encryption";
import { PrismaClient } from "../generated/prisma/client";

function argValue(flag: string): string | null {
  const prefix = `${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

const USAGE = `
Usage:
  npm run setup:location -- --name="CCI Glass Inc." --slug=cci-glass \\
    --zips=33101,33102,33109 [--account-id=xxx] [--key=hcp_api_key] \\
    [--deactivate-seed]

Options:
  --name              Display name for the franchise location
  --slug              URL-safe unique identifier
  --zips              Comma-separated service ZIP codes
  --account-id        Housecall Pro account identifier (optional)
  --key               Housecall Pro API key. Encrypted with AES-256-GCM
                      before it is stored. Omit to leave an existing key
                      untouched. Prefer HOUSECALL_PRO_API_KEY in .env over
                      passing this on a shell command line.
  --deactivate-seed   Deactivate every location whose name starts with the
                      test prefix, so seeded territories cannot catch a
                      real service address.
`;

function parseZipCodes(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((zip) => zip.trim())
        .filter((zip) => zip.length > 0),
    ),
  ];
}

async function main(): Promise<void> {
  const name = argValue("--name");
  const slug = argValue("--slug");
  const zipCodes = parseZipCodes(argValue("--zips"));
  const housecallProAccountId = argValue("--account-id");
  const apiKey = argValue("--key") ?? process.env.HOUSECALL_PRO_API_KEY ?? "";
  const deactivateSeed = process.argv.includes("--deactivate-seed");

  if (!name || !slug) {
    console.error(USAGE);
    process.exit(1);
  }

  if (zipCodes.length === 0) {
    console.error("");
    console.error("No ZIP codes given. A location with an empty territory");
    console.error("routes nothing, so every lead would stall at NEEDS_CALLBACK.");
    console.error(USAGE);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set in .env.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const territoryDefinition = { zipCodes, geoBoundary: null };

    const existing = await prisma.franchiseLocation.findUnique({
      where: { slug },
      select: { id: true, apiKeyEncrypted: true },
    });

    const apiKeyEncrypted =
      apiKey.length > 0
        ? encryptSecret(apiKey)
        : (existing?.apiKeyEncrypted ?? null);

    const saved = await prisma.franchiseLocation.upsert({
      where: { slug },
      update: {
        name,
        territoryDefinition,
        housecallProAccountId,
        apiKeyEncrypted,
        isActive: true,
      },
      create: {
        name,
        slug,
        territoryDefinition,
        housecallProAccountId,
        apiKeyEncrypted,
        isActive: true,
      },
      select: { id: true, name: true, slug: true },
    });

    console.log("");
    console.log(existing ? "Location updated." : "Location created.");
    console.log(`  id:    ${saved.id}`);
    console.log(`  name:  ${saved.name}`);
    console.log(`  slug:  ${saved.slug}`);
    console.log(`  zips:  ${zipCodes.join(", ")}`);
    console.log(
      `  key:   ${apiKeyEncrypted ? maskSecret(apiKey.length > 0 ? apiKey : "unchanged") : "NONE — sync will fail"}`,
    );

    const overlapping = await prisma.franchiseLocation.findMany({
      where: { isActive: true, slug: { not: slug } },
      select: { name: true, slug: true, territoryDefinition: true },
    });

    const claimed = new Set(zipCodes);
    const conflicts: string[] = [];

    for (const location of overlapping) {
      const definition = location.territoryDefinition as {
        zipCodes?: unknown;
      } | null;
      const otherZips = Array.isArray(definition?.zipCodes)
        ? (definition.zipCodes as unknown[]).filter(
            (zip): zip is string => typeof zip === "string",
          )
        : [];

      const shared = otherZips.filter((zip) => claimed.has(zip));
      if (shared.length > 0) {
        conflicts.push(`${location.name} (${location.slug}): ${shared.join(", ")}`);
      }
    }

    if (conflicts.length > 0) {
      console.log("");
      console.log("WARNING — overlapping ZIP codes with other active locations:");
      for (const conflict of conflicts) {
        console.log(`  ${conflict}`);
      }
      console.log("");
      console.log("Territory routing treats an overlap as AMBIGUOUS_TERRITORY and");
      console.log("holds the job for a human rather than guessing a location.");
    }

    if (deactivateSeed) {
      const deactivated = await prisma.franchiseLocation.updateMany({
        where: {
          isActive: true,
          slug: { not: slug },
          name: { startsWith: TEST_RECORD_PREFIX },
        },
        data: { isActive: false },
      });

      console.log("");
      console.log(
        `Deactivated ${deactivated.count} seeded ${TEST_RECORD_PREFIX} location(s).`,
      );
    }

    console.log("");
    console.log("Verify at /dashboard/locations before running an intake session.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Location setup failed:", error);
  process.exit(1);
});
