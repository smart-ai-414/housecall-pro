import { prisma } from "@/core/db/prisma";
import { recordSessionEvent } from "@/modules/intake/session-events";
import { assetTypeSchema, squareFootageOf } from "@/modules/perception/schemas";
import {
  matchCatalogue,
  type CatalogueMatchStatus,
  type DimensionSource,
} from "@/modules/pricing/catalogue-matcher";
import {
  catalogueSnapshotAgeInDays,
  catalogueSnapshotExportedAt,
  catalogueSnapshotIsStale,
} from "@/modules/pricing/catalogue-snapshot";

export type CatalogueMatchOutcomeStatus =
  CatalogueMatchStatus | "ALREADY_SYNCED" | "NO_SESSION";

export interface CatalogueMatchOutcome {
  status: CatalogueMatchOutcomeStatus;
  matchCount: number;
  reasons: string[];
}

interface DimensionRecord {
  squareFootage: number;
  customerConfirmed: boolean;
  customerCorrectedWidth: number | null;
  customerCorrectedHeight: number | null;
}

function customerSuppliedOwnMeasurement(dimensions: DimensionRecord): boolean {
  return (
    dimensions.customerCorrectedWidth !== null &&
    dimensions.customerCorrectedHeight !== null
  );
}

function confirmedSquareFeet(
  dimensions: DimensionRecord | null,
): number | null {
  if (dimensions === null) return null;

  const { customerCorrectedWidth, customerCorrectedHeight } = dimensions;

  if (customerCorrectedWidth !== null && customerCorrectedHeight !== null) {
    return squareFootageOf(customerCorrectedWidth, customerCorrectedHeight);
  }

  return dimensions.squareFootage;
}

function dimensionSourceOf(
  dimensions: DimensionRecord | null,
): DimensionSource {
  if (dimensions === null) return "UNCONFIRMED";
  if (customerSuppliedOwnMeasurement(dimensions)) return "CUSTOMER_MEASURED";
  if (dimensions.customerConfirmed) return "CUSTOMER_CONFIRMED";
  return "UNCONFIRMED";
}

export async function ensureCatalogueMatches(
  sessionId: string,
): Promise<CatalogueMatchOutcome> {
  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      shouldBypassPricing: true,
      classifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { assetType: true },
      },
      dimensionEstimates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          squareFootage: true,
          customerConfirmed: true,
          customerCorrectedWidth: true,
          customerCorrectedHeight: true,
        },
      },
      estimate: { select: { housecallProEstimateId: true } },
    },
  });

  if (session === null) {
    return { status: "NO_SESSION", matchCount: 0, reasons: [] };
  }

  if (session.estimate?.housecallProEstimateId) {
    const matchCount = await prisma.catalogueMatch.count({
      where: { sessionId },
    });

    return { status: "ALREADY_SYNCED", matchCount, reasons: [] };
  }

  const classification = session.classifications[0] ?? null;
  const dimensions = session.dimensionEstimates[0] ?? null;

  const parsedAssetType =
    classification === null
      ? null
      : assetTypeSchema.safeParse(classification.assetType);

  const plan = matchCatalogue({
    assetType: parsedAssetType?.success === true ? parsedAssetType.data : null,
    squareFeet: confirmedSquareFeet(dimensions),
    dimensionSource: dimensionSourceOf(dimensions),
    shouldBypassPricing: session.shouldBypassPricing,
  });

  const reasons = [...plan.reasons];

  if (plan.status === "MATCHED" && catalogueSnapshotIsStale()) {
    reasons.push(
      `The catalogue snapshot is ${catalogueSnapshotAgeInDays()} days old. Re-run npm run hcp:catalogue if the price book has moved since.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.catalogueMatch.deleteMany({ where: { sessionId } });

    if (plan.matches.length > 0) {
      await tx.catalogueMatch.createMany({
        data: plan.matches.map((match) => ({ sessionId, ...match })),
      });
    }
  });

  await recordSessionEvent(
    sessionId,
    plan.status === "MATCHED" ? "CATALOGUE_MATCHED" : "CATALOGUE_UNMATCHED",
    {
      status: plan.status,
      matchCount: plan.matches.length,
      reasons,
      catalogueExportedAt: catalogueSnapshotExportedAt().toISOString(),
      serviceItemIds: plan.matches.map((match) => match.housecallProServiceId),
    },
  );

  return {
    status: plan.status,
    matchCount: plan.matches.length,
    reasons,
  };
}
