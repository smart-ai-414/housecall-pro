import { randomUUID } from "node:crypto";

import { BRAND } from "@/core/config/branding";
import { prisma } from "@/core/db/prisma";
import { AppError } from "@/core/errors";
import {
  attachPhotosToEstimate,
  buildLineItemsFromCatalogueMatches,
  createUnsentEstimate,
} from "@/modules/housecall-pro/estimates";
import { createClientForLocation } from "@/modules/housecall-pro/location-client";
import { resolveCustomer } from "@/modules/housecall-pro/customers";
import {
  applyTestPrefix,
  describeWriteEnvironment,
  shouldMarkAsTestRecord,
} from "@/modules/housecall-pro/test-guard";
import type { JsonObject } from "@/modules/intake/conversation-state";
import { PHOTO_TYPE_GUIDANCE } from "@/modules/photos/photo-service";
import { createSignedReadUrl } from "@/modules/photos/storage";

export type SyncReason = "COMPLETED_INTAKE" | "ABANDONED_PARTIAL_LEAD";

export type SyncOutcome =
  | { status: "ALREADY_SYNCED"; housecallProEstimateId: string }
  | { status: "SYNCED"; housecallProEstimateId: string; estimateId: string }
  | { status: "NOT_ROUTED"; message: string }
  | { status: "FAILED"; message: string };

interface StructuredNotesHeader {
  source: string;
  reason: SyncReason;
  environment: string;
  sessionId: string;
  observed: {
    assetType: string | null;
    issueType: string | null;
    frameMaterialHint: string | null;
    classificationConfidence: number | null;
    lowConfidence: boolean;
  };
  measurements: {
    widthInches: number | null;
    heightInches: number | null;
    squareFootage: number | null;
    scaleReference: string | null;
    customerConfirmed: boolean;
  } | null;
  reviewerMustCheck: string[];
  photos: { label: string; url: string }[];
}

function renderNotes(header: StructuredNotesHeader): string {
  const lines: string[] = [
    `${header.source} — ${header.environment}`,
    "",
    `Reason for sync: ${header.reason === "COMPLETED_INTAKE" ? "Customer completed intake" : "Customer went silent; partial lead"}`,
    `Session: ${header.sessionId}`,
    "",
    "OBSERVED BY THE ASSISTANT (not verified):",
    `  Asset: ${header.observed.assetType ?? "not classified"}`,
    `  Issue: ${header.observed.issueType ?? "not classified"}`,
    `  Frame material hint: ${header.observed.frameMaterialHint ?? "none"}`,
    `  Confidence: ${
      header.observed.classificationConfidence === null
        ? "n/a"
        : header.observed.classificationConfidence.toFixed(2)
    }${header.observed.lowConfidence ? " (LOW — treat with suspicion)" : ""}`,
    "",
  ];

  if (header.measurements) {
    lines.push(
      "MEASUREMENTS:",
      `  ${header.measurements.widthInches ?? "?"} x ${header.measurements.heightInches ?? "?"} inches` +
        `${header.measurements.squareFootage ? ` (${header.measurements.squareFootage.toFixed(1)} sq ft)` : ""}`,
      `  Scale reference: ${header.measurements.scaleReference ?? "unknown"}`,
      `  Customer confirmed: ${header.measurements.customerConfirmed ? "YES" : "NO — do not price from these"}`,
      "",
    );
  } else {
    lines.push("MEASUREMENTS: none captured", "");
  }

  if (header.reviewerMustCheck.length > 0) {
    lines.push("REVIEWER MUST CHECK:");
    for (const item of header.reviewerMustCheck) {
      lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  if (header.photos.length > 0) {
    lines.push("PHOTOS:");
    for (const photo of header.photos) {
      lines.push(`  ${photo.label}: ${photo.url}`);
    }
    lines.push("");
  }

  lines.push(
    "This estimate was created unsent. Prices come from the price book, not from the assistant.",
  );

  return lines.join("\n");
}

export async function syncSessionToHousecallPro({
  sessionId,
  reason,
}: {
  sessionId: string;
  reason: SyncReason;
}): Promise<SyncOutcome> {
  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      serviceAddress: true,
      franchiseLocationId: true,
      isTestRecord: true,
      photos: {
        select: { photoType: true, storageKey: true },
      },
      classifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          assetType: true,
          issueType: true,
          frameMaterialHint: true,
          confidenceScore: true,
          isLowConfidence: true,
        },
      },
      dimensionEstimates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          widthInches: true,
          heightInches: true,
          squareFootage: true,
          scaleReferenceUsed: true,
          customerConfirmed: true,
          customerCorrectedWidth: true,
          customerCorrectedHeight: true,
        },
      },
      catalogueMatches: {
        select: {
          housecallProServiceId: true,
          serviceName: true,
          quantity: true,
          isBaseItem: true,
          isAdditionalOpening: true,
          openingIndex: true,
          needsReviewerCompletion: true,
        },
      },
      estimate: {
        select: {
          id: true,
          housecallProEstimateId: true,
          idempotencyKey: true,
          status: true,
          syncAttempts: true,
        },
      },
    },
  });

  if (!session) {
    throw new AppError("NOT_FOUND", "That session does not exist.");
  }

  if (session.estimate?.housecallProEstimateId) {
    return {
      status: "ALREADY_SYNCED",
      housecallProEstimateId: session.estimate.housecallProEstimateId,
    };
  }

  if (!session.franchiseLocationId) {
    return {
      status: "NOT_ROUTED",
      message:
        "The service address has not been routed to a franchise location. Nothing is created in Housecall Pro until it is.",
    };
  }

  const reservation = session.estimate
    ? await prisma.estimate.update({
        where: { id: session.estimate.id },
        data: { syncAttempts: { increment: 1 }, lastSyncError: null },
        select: { id: true, idempotencyKey: true },
      })
    : await prisma.estimate.create({
        data: {
          sessionId: session.id,
          idempotencyKey: randomUUID(),
          status: "SYNC_PENDING",
          syncAttempts: 1,
          isTestRecord: session.isTestRecord || shouldMarkAsTestRecord(),
        },
        select: { id: true, idempotencyKey: true },
      });

  try {
    const { client, locationName } = await createClientForLocation(
      session.franchiseLocationId,
    );

    const customer = await resolveCustomer(
      client,
      {
        name: session.customerName,
        phone: session.customerPhone,
        email: session.customerEmail,
        serviceAddress: session.serviceAddress,
      },
      `${reservation.idempotencyKey}-customer`,
    );

    const photos = await Promise.all(
      session.photos.map(async (photo) => ({
        label: PHOTO_TYPE_GUIDANCE[photo.photoType].label,
        storageKey: photo.storageKey,
        signedUrl: await createSignedReadUrl(photo.storageKey),
      })),
    );

    const classification = session.classifications[0] ?? null;
    const dimensions = session.dimensionEstimates[0] ?? null;

    const reviewerMustCheck: string[] = [];

    if (reason === "ABANDONED_PARTIAL_LEAD") {
      reviewerMustCheck.push(
        "Intake was never completed. Call the customer before quoting.",
      );
    }
    if (!dimensions) {
      reviewerMustCheck.push("No measurements were captured.");
    } else if (!dimensions.customerConfirmed) {
      reviewerMustCheck.push(
        "The customer never confirmed the measurements. Verify before pricing.",
      );
    }
    if (classification?.isLowConfidence) {
      reviewerMustCheck.push(
        "Classification confidence was low. Check the photos yourself.",
      );
    }
    if (session.catalogueMatches.length === 0) {
      reviewerMustCheck.push(
        "No catalogue items were matched. This estimate has no line items and must be built by hand.",
      );
    }
    if (session.catalogueMatches.some((m) => m.needsReviewerCompletion)) {
      reviewerMustCheck.push(
        "At least one line item had no good catalogue match.",
      );
    }
    reviewerMustCheck.push(
      "Safety glazing is asked or verified, never inferred. Confirm on site.",
    );

    const header: StructuredNotesHeader = {
      source: `${BRAND.productName} intake`,
      reason,
      environment: describeWriteEnvironment(),
      sessionId: session.id,
      observed: {
        assetType: classification?.assetType ?? null,
        issueType: classification?.issueType ?? null,
        frameMaterialHint: classification?.frameMaterialHint ?? null,
        classificationConfidence: classification?.confidenceScore ?? null,
        lowConfidence: classification?.isLowConfidence ?? false,
      },
      measurements: dimensions
        ? {
            widthInches:
              dimensions.customerCorrectedWidth ?? dimensions.widthInches,
            heightInches:
              dimensions.customerCorrectedHeight ?? dimensions.heightInches,
            squareFootage: dimensions.squareFootage,
            scaleReference: dimensions.scaleReferenceUsed,
            customerConfirmed: dimensions.customerConfirmed,
          }
        : null,
      reviewerMustCheck,
      photos: photos.map((photo) => ({
        label: photo.label,
        url: photo.signedUrl,
      })),
    };

    const estimate = await createUnsentEstimate(client, {
      customerId: customer.customerId,
      lineItems: buildLineItemsFromCatalogueMatches(session.catalogueMatches),
      note: applyTestPrefix(renderNotes(header)),
      idempotencyKey: reservation.idempotencyKey,
    });

    const saved = await prisma.estimate.update({
      where: { id: reservation.id },
      data: {
        housecallProEstimateId: estimate.id,
        housecallProCustomerId: customer.customerId,
        status: "CREATED_UNSENT",
        structuredNotesHeader: header as unknown as JsonObject,
        syncedAt: new Date(),
        lastSyncError: null,
      },
      select: { id: true, housecallProEstimateId: true },
    });

    await attachPhotosToEstimate({
      client,
      estimateId: estimate.id,
      photos,
    });

    await prisma.customerSession.update({
      where: { id: session.id },
      data: { status: "SYNCED" },
    });

    console.info(
      `[estimate-sync] session ${session.id} -> estimate ${estimate.id} at ${locationName}`,
    );

    return {
      status: "SYNCED",
      estimateId: saved.id,
      housecallProEstimateId: saved.housecallProEstimateId ?? estimate.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync failure";

    await prisma.estimate.update({
      where: { id: reservation.id },
      data: { status: "SYNC_FAILED", lastSyncError: message.slice(0, 1000) },
    });

    console.error(`[estimate-sync] session ${session.id} failed`, error);

    return { status: "FAILED", message };
  }
}
