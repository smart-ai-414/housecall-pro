import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { TEST_RECORD_PREFIX } from "../core/config/branding";
import { decryptSecret } from "../core/security/encryption";
import { PrismaClient } from "../generated/prisma/client";
import { createHousecallProClient } from "../modules/housecall-pro/client";

const DELETE_ENABLED = process.argv.includes("--delete");
const PURGE_LOCAL = process.argv.includes("--purge-local");

interface RemoteRecord {
  kind: "estimate" | "customer";
  housecallProId: string;
  locationId: string;
  locationName: string;
  localEstimateId: string;
}

function heading(text: string): void {
  console.log("");
  console.log(text);
  console.log("-".repeat(text.length));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set in .env.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const testEstimates = await prisma.estimate.findMany({
      where: { isTestRecord: true },
      select: {
        id: true,
        housecallProEstimateId: true,
        housecallProCustomerId: true,
        status: true,
        createdAt: true,
        session: {
          select: {
            id: true,
            customerName: true,
            franchiseLocationId: true,
            franchiseLocation: {
              select: { id: true, name: true, apiKeyEncrypted: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const testSessions = await prisma.customerSession.count({
      where: { isTestRecord: true },
    });

    heading("Local test records");
    console.log(`  sessions:  ${testSessions}`);
    console.log(`  estimates: ${testEstimates.length}`);

    const remote: RemoteRecord[] = [];
    const keysByLocation = new Map<string, string>();

    for (const estimate of testEstimates) {
      const location = estimate.session.franchiseLocation;
      if (!location?.apiKeyEncrypted) continue;

      keysByLocation.set(location.id, decryptSecret(location.apiKeyEncrypted));

      if (estimate.housecallProEstimateId) {
        remote.push({
          kind: "estimate",
          housecallProId: estimate.housecallProEstimateId,
          locationId: location.id,
          locationName: location.name,
          localEstimateId: estimate.id,
        });
      }

      if (estimate.housecallProCustomerId) {
        remote.push({
          kind: "customer",
          housecallProId: estimate.housecallProCustomerId,
          locationId: location.id,
          locationName: location.name,
          localEstimateId: estimate.id,
        });
      }
    }

    heading("Records written into the live Housecall Pro account");

    if (remote.length === 0) {
      console.log("  None. Nothing reached Housecall Pro from a test record.");
    } else {
      for (const record of remote) {
        console.log(
          `  ${record.kind.padEnd(9)} ${record.housecallProId}  (${record.locationName})`,
        );
      }
    }

    const orphaned = testEstimates.filter(
      (estimate) =>
        estimate.housecallProEstimateId !== null &&
        !estimate.session.franchiseLocation?.apiKeyEncrypted,
    );

    if (orphaned.length > 0) {
      heading("Cannot be reached programmatically");
      console.log(
        "  These reached Housecall Pro but their location no longer holds an",
      );
      console.log("  API key. Delete them by hand in the Housecall Pro UI:");
      for (const estimate of orphaned) {
        console.log(`    estimate ${estimate.housecallProEstimateId}`);
      }
    }

    if (!DELETE_ENABLED) {
      heading("Dry run");
      console.log("  Nothing was deleted.");
      console.log("");
      console.log("  Re-run with --delete to remove the remote records above.");
      console.log(
        "  Add --purge-local to also delete the local sessions and estimates.",
      );
      console.log("");
      console.log(
        `  Every record listed carries the ${TEST_RECORD_PREFIX} prefix. Anything without it`,
      );
      console.log("  belongs to a real customer and is never touched here.");
      return;
    }

    heading("Deleting remote records");

    let deleted = 0;
    let failed = 0;

    for (const record of remote) {
      const apiKey = keysByLocation.get(record.locationId);
      if (!apiKey) continue;

      const client = createHousecallProClient(apiKey);
      const path =
        record.kind === "estimate"
          ? `estimates/${record.housecallProId}`
          : `customers/${record.housecallProId}`;

      try {
        await client.request({ method: "DELETE", path, attemptLimit: 1 });
        console.log(`  deleted ${record.kind} ${record.housecallProId}`);
        deleted += 1;
      } catch (error) {
        console.log(
          `  FAILED  ${record.kind} ${record.housecallProId} — ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        console.log("          delete this one by hand in Housecall Pro");
        failed += 1;
      }
    }

    console.log("");
    console.log(`  ${deleted} deleted, ${failed} left for manual cleanup`);

    if (PURGE_LOCAL) {
      heading("Purging local test rows");
      const removedSessions = await prisma.customerSession.deleteMany({
        where: { isTestRecord: true },
      });
      console.log(
        `  ${removedSessions.count} sessions removed (estimates, photos and events cascade)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
