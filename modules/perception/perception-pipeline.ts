import { perceptionEnv } from "@/core/config/env";
import { prisma } from "@/core/db/prisma";
import type { PhotoType, ScaleReference } from "@/generated/prisma/enums";
import {
  parseConversationState,
  type ConversationState,
  type JsonObject,
} from "@/modules/intake/conversation-state";
import {
  isQuestionId,
  QUESTION_BANK,
  type QuestionId,
} from "@/modules/intake/question-bank";
import { recordSessionEvent } from "@/modules/intake/session-events";
import { PHOTO_TYPE_GUIDANCE } from "@/modules/photos/photo-service";
import { downloadObject } from "@/modules/photos/storage";
import "@/modules/perception/index";
import {
  estimateDimensions,
  observe,
} from "@/modules/perception/perception-service";
import { priceBandFor } from "@/modules/perception/price-bands";
import {
  assessPricingGate,
  confidenceThreshold,
} from "@/modules/perception/pricing-gate";
import {
  isLowConfidence,
  squareFootageOf,
  type ClassificationResult,
  type DimensionResult,
  type PhotoQualityResult,
} from "@/modules/perception/schemas";
import type {
  PerceptionOutcome,
  PerceptionPhoto,
} from "@/modules/perception/types";

const MAX_CUSTOMER_MESSAGES_IN_DESCRIPTION = 6;
const FALLBACK_MAX_RUNS_PER_SESSION = 3;

export const PERCEPTION_STAGE_TIMEOUT_MS = 25_000;

const NO_SCALE_REFERENCE_FOUND =
  "No scale reference was visible in the photographs.";

const DIMENSIONS_NOT_WORTH_READING =
  "The photographs were not good enough to price from, so no size was read.";

export interface PerceptionDimensions {
  widthInches: number;
  heightInches: number;
  squareFootage: number;
  priceBand: string;
  scaleReferenceUsed: ScaleReference;
  confidence: number;
  reasoning: string | null;
}

export interface PerceptionSummary {
  classification: ClassificationResult | null;
  photoQuality: PhotoQualityResult | null;
  dimensions: PerceptionDimensions | null;
  noDimensionReason: string | null;
  shouldBypassPricing: boolean;
  bypassReasons: string[];
  requestCornerCloseUp: boolean;
}

export type PerceptionRunOutcome =
  | { status: "COMPLETED"; summary: PerceptionSummary }
  | { status: "SKIPPED"; reason: string; customerIsWaiting: boolean }
  | { status: "FAILED"; reason: string };

export function describeCustomerReport(state: ConversationState): string {
  const answers = Object.entries(state.collected.answers)
    .filter(([questionId]) => isQuestionId(questionId))
    .map(
      ([questionId, answer]) =>
        `${QUESTION_BANK[questionId as QuestionId].prompt} ${answer}`,
    );

  const recentMessages = state.messages
    .filter((message) => message.role === "customer")
    .slice(-MAX_CUSTOMER_MESSAGES_IN_DESCRIPTION)
    .map((message) => message.content);

  const combined = [...answers, ...recentMessages].join(" ").trim();

  return combined === "" ? "The customer did not describe the job." : combined;
}

async function loadPhotos(
  photos: readonly {
    photoType: PhotoType;
    storageKey: string;
    contentType: string;
  }[],
): Promise<PerceptionPhoto[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      label: PHOTO_TYPE_GUIDANCE[photo.photoType].label,
      contentType: photo.contentType,
      data: await downloadObject(photo.storageKey),
    })),
  );
}

function maxRunsPerSession(): number {
  try {
    return perceptionEnv().PERCEPTION_MAX_RUNS_PER_SESSION;
  } catch {
    return FALLBACK_MAX_RUNS_PER_SESSION;
  }
}

function asJson(value: unknown): JsonObject {
  return (value ?? {}) as JsonObject;
}

function describeMissingDimensions(
  outcome: PerceptionOutcome<DimensionResult> | null,
): string {
  if (outcome === null) return DIMENSIONS_NOT_WORTH_READING;
  if (outcome.status === "FAILED") return outcome.reason.slice(0, 500);
  return outcome.value.reasoning ?? NO_SCALE_REFERENCE_FOUND;
}

function dimensionsFrom(result: DimensionResult): PerceptionDimensions | null {
  if (result.status !== "ESTIMATED") return null;

  const squareFootage = squareFootageOf(
    result.widthInches,
    result.heightInches,
  );

  return {
    widthInches: result.widthInches,
    heightInches: result.heightInches,
    squareFootage,
    priceBand: priceBandFor(squareFootage),
    scaleReferenceUsed: result.scaleReferenceUsed,
    confidence: result.confidence,
    reasoning: result.reasoning ?? null,
  };
}

export async function perceptionIsPending(sessionId: string): Promise<boolean> {
  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      perceptionRunCount: true,
      photos: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      classifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  if (!session) return false;
  if (session.perceptionRunCount >= maxRunsPerSession()) return false;

  const latestPhoto = session.photos[0];
  if (!latestPhoto) return false;

  const latestClassification = session.classifications[0];
  if (!latestClassification) return true;

  return latestPhoto.createdAt > latestClassification.createdAt;
}

export async function runPerceptionForSession(
  sessionId: string,
): Promise<PerceptionRunOutcome> {
  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      conversationState: true,
      perceptionRunCount: true,
      requestedPhotoTypes: true,
      declinedPhotoTypes: true,
      photos: {
        select: { photoType: true, storageKey: true, contentType: true },
      },
    },
  });

  if (!session) {
    return {
      status: "SKIPPED",
      reason: "No such session.",
      customerIsWaiting: false,
    };
  }

  if (session.photos.length === 0) {
    return {
      status: "SKIPPED",
      reason: "No photographs have been received.",
      customerIsWaiting: false,
    };
  }

  if (session.perceptionRunCount >= maxRunsPerSession()) {
    return {
      status: "SKIPPED",
      reason: "This session has already used its perception budget.",
      customerIsWaiting: true,
    };
  }

  await prisma.customerSession.update({
    where: { id: sessionId },
    data: { perceptionRunCount: { increment: 1 }, status: "CLASSIFYING" },
  });

  await recordSessionEvent(sessionId, "PERCEPTION_STARTED", {
    photoCount: session.photos.length,
    run: session.perceptionRunCount + 1,
  });

  try {
    const photos = await loadPhotos(session.photos);
    const customerDescription = describeCustomerReport(
      parseConversationState(session.conversationState),
    );
    const input = { photos, customerDescription };

    const observationOutcome = await observe(input, {
      timeoutMs: PERCEPTION_STAGE_TIMEOUT_MS,
    });

    if (observationOutcome.status === "FAILED") {
      await recordSessionEvent(sessionId, "PERCEPTION_FAILED", {
        stage: "observe",
        reason: observationOutcome.reason.slice(0, 500),
        provider: observationOutcome.provider,
      });

      await prisma.customerSession.update({
        where: { id: sessionId },
        data: { status: "NEEDS_CALLBACK", shouldBypassPricing: true },
      });

      return { status: "FAILED", reason: observationOutcome.reason };
    }

    const { classification, photoQuality } = observationOutcome.value;
    const gate = assessPricingGate({ classification, photoQuality });

    const dimensionOutcome = gate.shouldBypassPricing
      ? null
      : await estimateDimensions(
          { ...input, assetType: classification.assetType },
          { timeoutMs: PERCEPTION_STAGE_TIMEOUT_MS },
        );

    const dimensionResult =
      dimensionOutcome?.status === "OK" ? dimensionOutcome.value : null;
    const dimensions = dimensionResult ? dimensionsFrom(dimensionResult) : null;

    await prisma.classification.create({
      data: {
        sessionId,
        assetType: classification.assetType,
        issueType: classification.issueType,
        frameMaterialHint: classification.frameMaterialHint,
        confidenceScore: classification.confidence,
        photoQualityAssessment: photoQuality.overall,
        photoQualityProblems: photoQuality.problems,
        observationSummary: classification.reasoning ?? null,
        isLowConfidence: isLowConfidence(
          classification.confidence,
          confidenceThreshold(),
        ),
        bypassesPricing: gate.shouldBypassPricing,
        rawModelOutput: asJson(observationOutcome.rawOutput),
        modelVersion: `${observationOutcome.provider}:${observationOutcome.model}`,
      },
    });

    if (dimensions) {
      await prisma.dimensionEstimate.create({
        data: {
          sessionId,
          widthInches: dimensions.widthInches,
          heightInches: dimensions.heightInches,
          squareFootage: dimensions.squareFootage,
          scaleReferenceUsed: dimensions.scaleReferenceUsed,
          scaleReferenceNote: dimensions.reasoning,
          confidenceScore: dimensions.confidence,
          priceBand: dimensions.priceBand,
        },
      });
    } else {
      await recordSessionEvent(sessionId, "PERCEPTION_SKIPPED", {
        stage: "estimateDimensions",
        reason: describeMissingDimensions(dimensionOutcome),
      });
    }

    await prisma.customerSession.update({
      where: { id: sessionId },
      data: { shouldBypassPricing: gate.shouldBypassPricing },
    });

    if (gate.shouldBypassPricing) {
      await recordSessionEvent(sessionId, "PRICING_BYPASSED", {
        reasons: gate.reasons,
      });
    }

    await recordSessionEvent(sessionId, "PERCEPTION_SUCCEEDED", {
      assetType: classification.assetType,
      issueType: classification.issueType,
      confidence: classification.confidence,
      photoQuality: photoQuality.overall,
      dimensionsEstimated: dimensions !== null,
      provider: observationOutcome.provider,
      model: observationOutcome.model,
    });

    const closeUpAlreadyHandled =
      session.requestedPhotoTypes.includes("CORNER_CLOSEUP") ||
      session.declinedPhotoTypes.includes("CORNER_CLOSEUP") ||
      session.photos.some((photo) => photo.photoType === "CORNER_CLOSEUP");

    return {
      status: "COMPLETED",
      summary: {
        classification,
        photoQuality,
        dimensions,
        noDimensionReason:
          dimensions === null
            ? describeMissingDimensions(dimensionOutcome)
            : null,
        shouldBypassPricing: gate.shouldBypassPricing,
        bypassReasons: gate.reasons,
        requestCornerCloseUp:
          photoQuality.shouldRequestCornerCloseUp &&
          !closeUpAlreadyHandled,
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    await recordSessionEvent(sessionId, "PERCEPTION_FAILED", {
      stage: "pipeline",
      reason: reason.slice(0, 500),
    });

    console.error(`[perception] session ${sessionId} failed`, error);

    return { status: "FAILED", reason };
  }
}
