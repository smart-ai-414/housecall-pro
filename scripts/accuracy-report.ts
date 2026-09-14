import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { priceBandFor } from "../modules/perception/price-bands";
import { squareFootageOf } from "../modules/perception/schemas";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Fill it in .env and try again.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const CONFIDENCE_BUCKETS = [
  { label: "0.00 - 0.49", lower: 0, upper: 0.5 },
  { label: "0.50 - 0.59", lower: 0.5, upper: 0.6 },
  { label: "0.60 - 0.74", lower: 0.6, upper: 0.75 },
  { label: "0.75 - 0.89", lower: 0.75, upper: 0.9 },
  { label: "0.90 - 1.00", lower: 0.9, upper: 1.0001 },
];

const CALIBRATION_TARGET_SUBMISSIONS = 30;

interface Tally {
  correct: number;
  total: number;
}

function record(tally: Tally, wasCorrect: boolean): void {
  tally.total += 1;
  if (wasCorrect) tally.correct += 1;
}

function percent({ correct, total }: Tally): string {
  if (total === 0) return "no data";
  return `${((correct / total) * 100).toFixed(0)}% (${correct}/${total})`;
}

function emptyTally(): Tally {
  return { correct: 0, total: 0 };
}

async function main() {
  const estimates = await prisma.estimate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      isTestRecord: true,
      reviewerEdits: {
        select: { fieldChanged: true, newValue: true },
      },
      session: {
        select: {
          shouldBypassPricing: true,
          classifications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              assetType: true,
              issueType: true,
              confidenceScore: true,
              modelVersion: true,
            },
          },
          dimensionEstimates: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              widthInches: true,
              heightInches: true,
              squareFootage: true,
              customerConfirmed: true,
              customerCorrectedWidth: true,
              customerCorrectedHeight: true,
            },
          },
        },
      },
    },
  });

  const reviewed = estimates.filter(
    (estimate) => estimate.reviewerEdits.length > 0,
  );

  const assetType = emptyTally();
  const issueType = emptyTally();
  const dimensionBand = emptyTally();
  const byConfidence = new Map<string, Tally>(
    CONFIDENCE_BUCKETS.map((bucket) => [bucket.label, emptyTally()]),
  );
  const models = new Map<string, number>();

  let classified = 0;
  let bypassed = 0;
  let dimensionsRead = 0;
  let dimensionsConfirmed = 0;

  for (const estimate of estimates) {
    const classification = estimate.session.classifications[0] ?? null;
    const dimensions = estimate.session.dimensionEstimates[0] ?? null;

    if (estimate.session.shouldBypassPricing) bypassed += 1;
    if (!classification) continue;

    classified += 1;
    models.set(
      classification.modelVersion,
      (models.get(classification.modelVersion) ?? 0) + 1,
    );

    const edits = new Set(
      estimate.reviewerEdits.map((edit) => edit.fieldChanged),
    );
    const wasReviewed = estimate.reviewerEdits.length > 0;

    if (wasReviewed) {
      record(assetType, !edits.has("assetType"));
      record(issueType, !edits.has("issueType"));

      const bucket = CONFIDENCE_BUCKETS.find(
        (candidate) =>
          classification.confidenceScore >= candidate.lower &&
          classification.confidenceScore < candidate.upper,
      );

      if (bucket) {
        record(
          byConfidence.get(bucket.label) ?? emptyTally(),
          !edits.has("assetType") && !edits.has("issueType"),
        );
      }
    }

    if (!dimensions) continue;

    dimensionsRead += 1;
    if (dimensions.customerConfirmed) dimensionsConfirmed += 1;

    const correctedWidth =
      dimensions.customerCorrectedWidth ??
      readNumericEdit(estimate.reviewerEdits, "widthInches");
    const correctedHeight =
      dimensions.customerCorrectedHeight ??
      readNumericEdit(estimate.reviewerEdits, "heightInches");

    if (dimensions.customerConfirmed) {
      record(dimensionBand, true);
      continue;
    }

    if (correctedWidth === null || correctedHeight === null) continue;

    record(
      dimensionBand,
      priceBandFor(dimensions.squareFootage) ===
        priceBandFor(squareFootageOf(correctedWidth, correctedHeight)),
    );
  }

  console.log("\nGLASSBOT PERCEPTION ACCURACY\n");
  console.log(`  Estimates                  ${estimates.length}`);
  console.log(`  With a classification      ${classified}`);
  console.log(`  With a reviewer correction ${reviewed.length}`);
  console.log(`  Pricing bypassed           ${bypassed}`);
  console.log(`  Dimensions read            ${dimensionsRead}`);
  console.log(`  Dimensions confirmed       ${dimensionsConfirmed}`);

  console.log("\n  MODELS");
  for (const [model, count] of models) {
    console.log(`    ${model.padEnd(40)} ${count}`);
  }

  console.log("\n  ACCURACY (reviewed estimates only)");
  console.log(`    Asset type       ${percent(assetType)}`);
  console.log(`    Issue type       ${percent(issueType)}`);
  console.log(`    Dimension band   ${percent(dimensionBand)}`);

  console.log("\n  CALIBRATION BY CONFIDENCE");
  for (const bucket of CONFIDENCE_BUCKETS) {
    const tally = byConfidence.get(bucket.label) ?? emptyTally();
    console.log(`    ${bucket.label}      ${percent(tally)}`);
  }

  if (classified < CALIBRATION_TARGET_SUBMISSIONS) {
    console.log(
      `\n  Not enough data yet. Phase 2 calls for ${CALIBRATION_TARGET_SUBMISSIONS} real submissions ` +
        `before these numbers set a threshold; there are ${classified}.`,
    );
  } else {
    console.log(
      "\n  Enough data to set PERCEPTION_CONFIDENCE_THRESHOLD from the calibration table above.",
    );
  }

  console.log("");
  await prisma.$disconnect();
}

function readNumericEdit(
  edits: readonly { fieldChanged: string; newValue: string | null }[],
  field: string,
): number | null {
  const edit = edits.find((candidate) => candidate.fieldChanged === field);
  if (!edit?.newValue) return null;

  const parsed = Number.parseFloat(edit.newValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
