import { randomUUID } from "node:crypto";

import { BRAND } from "@/core/config/branding";
import { housecallProLeadSource, publicAppUrl } from "@/core/config/env";
import { prisma } from "@/core/db/prisma";
import { AppError } from "@/core/errors";
import {
  buildLineItemsFromCatalogueMatches,
  createUnsentEstimate,
} from "@/modules/housecall-pro/estimates";
import {
  renderNotes,
  type StructuredNotesHeader,
  type SyncReason,
} from "@/modules/estimates/estimate-notes";
import { createClientForLocation } from "@/modules/housecall-pro/location-client";
import { resolveCustomer } from "@/modules/housecall-pro/customers";
import {
  applyTestPrefix,
  describeWriteEnvironment,
  shouldMarkAsTestRecord,
} from "@/modules/housecall-pro/test-guard";
import {
  assessSessionCompleteness,
  describeMissingRequirements,
} from "@/modules/intake/completion";
import {
  parseConversationState,
  type JsonObject,
} from "@/modules/intake/conversation-state";
import { catalogueSnapshotExportedAt } from "@/modules/pricing/catalogue-snapshot";
import { ensureCatalogueMatches } from "@/modules/pricing/pricing-service";
import {
  isQuestionId,
  QUESTION_BANK,
  SAFETY_GLAZING_QUESTION_ID,
  safetyGlazingMayBeRequired,
  type QuestionId,
} from "@/modules/intake/question-bank";
import { recordSessionEvent } from "@/modules/intake/session-events";
import { buildDurablePhotoUrl } from "@/modules/photos/photo-link";
import { PHOTO_TYPE_GUIDANCE } from "@/modules/photos/photo-service";
import { createSignedReadUrl } from "@/modules/photos/storage";

export type { SyncReason } from "@/modules/estimates/estimate-notes";

export type SyncOutcome =
  | { status: "ALREADY_SYNCED"; housecallProEstimateId: string }
  | { status: "SYNCED"; housecallProEstimateId: string; estimateId: string }
  | { status: "NOT_ROUTED"; message: string }
  | { status: "FAILED"; message: string };

function describePricingBypass(
  classification: {
    assetType: string;
    issueType: string;
    confidenceScore: number;
    isLowConfidence: boolean;
    photoQualityAssessment: string | null;
  } | null,
): string[] {
  if (classification === null) {
    return [
      "Automatic photo analysis was unavailable for this job, so nothing was classified. The photographs are linked above and need reading by hand.",
    ];
  }

  const reasons: string[] = [];

  if (classification.isLowConfidence) {
    reasons.push(
      `Classification confidence was ${Math.round(classification.confidenceScore * 100)}%.`,
    );
  }
  if (classification.assetType === "UNKNOWN") {
    reasons.push("The assistant could not tell what kind of opening this is.");
  }
  if (classification.issueType === "UNKNOWN") {
    reasons.push("The assistant could not tell what is wrong with the glass.");
  }
  if (classification.photoQualityAssessment === "UNUSABLE") {
    reasons.push("The photographs were not usable.");
  }

  return reasons;
}

function describeUnresolved({
  outstandingQuestions,
  classification,
  dimensions,
}: {
  outstandingQuestions: readonly string[];
  classification: { frameMaterialHint: string | null } | null;
  dimensions: unknown;
}): string[] {
  const unresolved = outstandingQuestions
    .filter(isQuestionId)
    .map((questionId) => QUESTION_BANK[questionId as QuestionId].prompt);

  if (classification === null) {
    unresolved.push("What kind of opening this is and what is wrong with it");
  } else if (
    classification.frameMaterialHint === null ||
    classification.frameMaterialHint === "UNKNOWN"
  ) {
    unresolved.push("Frame material");
  }

  if (dimensions === null) unresolved.push("Opening size");

  return unresolved;
}

export async function syncSessionToHousecallPro({
  sessionId,
  reason,
}: {
  sessionId: string;
  reason: SyncReason;
}): Promise<SyncOutcome> {
  const catalogueOutcome = await ensureCatalogueMatches(sessionId);

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
      conversationState: true,
      outstandingQuestions: true,
      shouldBypassPricing: true,
      photos: {
        select: { id: true, photoType: true, storageKey: true },
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
          photoQualityAssessment: true,
          photoQualityProblems: true,
          observationSummary: true,
          bypassesPricing: true,
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
          scaleReferenceUsed: true,
          scaleReferenceNote: true,
          confidenceScore: true,
          priceBand: true,
          customerConfirmed: true,
          customerCorrectedWidth: true,
          customerCorrectedHeight: true,
        },
      },
      catalogueMatches: {
        orderBy: { isBaseItem: "desc" },
        select: {
          housecallProServiceId: true,
          serviceName: true,
          quantity: true,
          isBaseItem: true,
          isAdditionalOpening: true,
          openingIndex: true,
          matchConfidence: true,
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
        select: { id: true, idempotencyKey: true, syncAttempts: true },
      })
    : await prisma.estimate.create({
        data: {
          sessionId: session.id,
          idempotencyKey: randomUUID(),
          status: "SYNC_PENDING",
          syncAttempts: 1,
          isTestRecord: session.isTestRecord || shouldMarkAsTestRecord(),
        },
        select: { id: true, idempotencyKey: true, syncAttempts: true },
      });

  await recordSessionEvent(session.id, "SYNC_STARTED", {
    reason,
    attempt: reservation.syncAttempts,
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
        signedUrl:
          buildDurablePhotoUrl(photo.id) ??
          (await createSignedReadUrl(photo.storageKey)),
      })),
    );

    const photoLinksExpireSoon = publicAppUrl() === null;

    const classification = session.classifications[0] ?? null;
    const dimensions = session.dimensionEstimates[0] ?? null;

    const collected = parseConversationState(
      session.conversationState,
    ).collected;
    const safetyGlazingAnswer =
      collected.answers[SAFETY_GLAZING_QUESTION_ID] ?? null;

    const customerSaid = Object.entries(collected.answers)
      .filter(([questionId]) => isQuestionId(questionId))
      .map(([questionId, answer]) => ({
        question: QUESTION_BANK[questionId as QuestionId].prompt,
        answer,
      }));

    const reviewerMustCheck: string[] = [];

    if (reason === "ABANDONED_PARTIAL_LEAD") {
      const { missing } = await assessSessionCompleteness(session.id);

      reviewerMustCheck.push(
        "Intake was never completed. Call the customer before quoting.",
        ...describeMissingRequirements(missing),
      );
    }
    const customerCorrected =
      dimensions?.customerCorrectedWidth != null &&
      dimensions?.customerCorrectedHeight != null;

    if (!dimensions) {
      reviewerMustCheck.push("No measurements were captured.");
    } else if (!dimensions.customerConfirmed && !customerCorrected) {
      reviewerMustCheck.push(
        "The customer never confirmed the measurements. Verify before pricing.",
      );
    }
    if (session.shouldBypassPricing) {
      reviewerMustCheck.push(
        "Pricing was bypassed. Nothing here was matched to the price book; quote this one by hand.",
      );
    }
    if (classification?.isLowConfidence) {
      reviewerMustCheck.push(
        "Classification confidence was low. Check the photos yourself.",
      );
    }
    if (session.catalogueMatches.length === 0) {
      reviewerMustCheck.push(
        "No catalogue item was matched. The single line item is a placeholder with no price — replace it from the price book.",
      );
    }
    if (!session.shouldBypassPricing) {
      reviewerMustCheck.push(...catalogueOutcome.reasons);
    }
    if (session.catalogueMatches.some((m) => m.needsReviewerCompletion)) {
      reviewerMustCheck.push(
        "At least one line item had no good catalogue match.",
      );
    }
    if (photoLinksExpireSoon && photos.length > 0) {
      reviewerMustCheck.push(
        "PUBLIC_APP_URL is unset, so the photo links below expire within minutes. Open them now or set that variable and re-sync.",
      );
    }
    if (safetyGlazingMayBeRequired(safetyGlazingAnswer) === true) {
      reviewerMustCheck.push(
        "Safety glazing may be required — see the section below.",
      );
    } else if (safetyGlazingAnswer === null) {
      reviewerMustCheck.push(
        "Safety glazing was never asked. It is asked or verified, never inferred.",
      );
    }

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
        photoQuality: classification?.photoQualityAssessment ?? null,
        photoQualityProblems: classification?.photoQualityProblems ?? [],
        summary: classification?.observationSummary ?? null,
        modelVersion: classification?.modelVersion ?? null,
      },
      pricing: {
        bypassed: session.shouldBypassPricing,
        reasons: session.shouldBypassPricing
          ? describePricingBypass(classification)
          : [],
      },
      pricingTemplateApplies: session.catalogueMatches.length === 0,
      catalogue: {
        snapshotExportedAt: catalogueSnapshotExportedAt().toISOString(),
        matches: session.catalogueMatches.map((match) => ({
          serviceName: match.serviceName,
          matchConfidence: match.matchConfidence,
          isBaseItem: match.isBaseItem,
        })),
      },
      customerSaid,
      safetyGlazing: {
        answered: safetyGlazingAnswer !== null,
        mayBeRequired: safetyGlazingMayBeRequired(safetyGlazingAnswer),
        answer: safetyGlazingAnswer,
      },
      measurements: dimensions
        ? {
            widthInches:
              dimensions.customerCorrectedWidth ?? dimensions.widthInches,
            heightInches:
              dimensions.customerCorrectedHeight ?? dimensions.heightInches,
            squareFootage: dimensions.squareFootage,
            priceBand: dimensions.priceBand,
            scaleReference: dimensions.scaleReferenceUsed,
            scaleReferenceNote: dimensions.scaleReferenceNote,
            dimensionConfidence: dimensions.confidenceScore,
            customerConfirmed: dimensions.customerConfirmed,
            customerCorrected,
          }
        : null,
      unresolved: describeUnresolved({
        outstandingQuestions: session.outstandingQuestions,
        classification,
        dimensions,
      }),
      reviewerMustCheck,
      photos: photos.map((photo) => ({
        label: photo.label,
        url: photo.signedUrl,
      })),
    };

    const estimate = await createUnsentEstimate(client, {
      customerId: customer.customerId,
      leadSource: housecallProLeadSource(),
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

    await prisma.customerSession.update({
      where: { id: session.id },
      data: { status: "SYNCED" },
    });

    await recordSessionEvent(session.id, "SYNC_SUCCEEDED", {
      housecallProEstimateId: estimate.id,
      locationName,
      photoCount: photos.length,
      lineItemCount: session.catalogueMatches.length,
      catalogueMatchStatus: catalogueOutcome.status,
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

    await recordSessionEvent(session.id, "SYNC_FAILED", {
      reason,
      attempt: reservation.syncAttempts,
      message: message.slice(0, 500),
    });

    console.error(`[estimate-sync] session ${session.id} failed`, error);

    return { status: "FAILED", message };
  }
}
