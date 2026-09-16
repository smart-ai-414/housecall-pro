import { randomUUID } from "node:crypto";

import { prisma } from "@/core/db/prisma";
import { AppError } from "@/core/errors";
import {
  createResumeToken,
  verifyResumeToken,
} from "@/core/security/resume-token";
import {
  consumeSessionCreationBudget,
  describeRateLimit,
} from "@/core/security/rate-limit";
import { normalizePhone } from "@/core/utils/format";
import type { PhotoType, SessionStatus } from "@/generated/prisma/enums";
import {
  appendMessages,
  createMessage,
  mergeCollectedDetails,
  parseConversationState,
  toPlainJson,
  visibleTranscript,
  type ChatMessage,
  type ConversationState,
} from "@/modules/intake/conversation-state";
import {
  describeDimensionEstimate,
  DIMENSION_CONFIRMATION_QUESTION_ID,
  FORM_ANSWERED_QUESTION_IDS,
  OPENING_QUESTION_SEQUENCE,
  QUESTION_BANK,
  QUESTIONS_NOT_ANSWERABLE_BY_FREE_TEXT,
} from "@/modules/intake/question-bank";
import { recordSessionEvent } from "@/modules/intake/session-events";
import { assessSessionCompleteness } from "@/modules/intake/completion";
import { syncSessionToHousecallPro } from "@/modules/estimates/estimate-sync-service";
import { shouldMarkAsTestRecord } from "@/modules/housecall-pro/test-guard";
import {
  perceptionIsPending,
  runPerceptionForSession,
  type PerceptionSummary,
} from "@/modules/perception/perception-pipeline";
import {
  CONDITIONAL_PHOTO_TYPE,
  CORNER_CLOSEUP_REQUEST_MESSAGE,
  isPhotoUploadAvailable,
  outstandingPhotoTypesFor,
  PHOTO_TYPE_GUIDANCE,
  REQUIRED_PHOTO_TYPES,
} from "@/modules/photos/photo-service";
import type {
  DimensionConfirmationPrompt,
  IntakeSessionView,
  IntakeSessionWithRouting,
} from "@/modules/intake/types";
import {
  describeRoutingResult,
  resolveFranchiseLocation,
  routedLocationOf,
} from "@/modules/tenancy/territory-routing";

const OPENING_MESSAGE_WITH_PHOTOS = [
  "Hi — I can get you an estimate for broken or failed glass.",
  "",
  "I need two photos and a couple of short answers. It takes about three minutes.",
  "",
  "I will read the size from the photos and ask you to check it, then take your details at the end. A glazier prices the work and sends you the estimate.",
].join("\n");

const OPENING_MESSAGE_WITHOUT_PHOTOS = [
  "Hi — I can get your glass repair or replacement in front of our team.",
  "",
  "Photo upload is not switched on yet. Tell me what happened in your own words and I will take your details at the end. A glazier will follow up to measure and price the work.",
].join("\n");

const LOOKING_AT_PHOTOS_MESSAGE =
  "Thanks. Let me look at those photos for a moment.";

const PERCEPTION_UNAVAILABLE_MESSAGE = [
  "I was not able to read those photos automatically just now. That is not a",
  "problem and it is nothing you did — I have kept them and passed everything to",
  "our team, and a glazier will review them and come back to you with an estimate.",
].join(" ");

const NO_SCALE_REFERENCE_MESSAGE = [
  "I can see the damage, but there is nothing in the photos that tells me the size",
  "reliably, so I would rather not guess. A glazier will measure it.",
].join(" ");

function openingMessage(): string {
  return isPhotoUploadAvailable()
    ? OPENING_MESSAGE_WITH_PHOTOS
    : OPENING_MESSAGE_WITHOUT_PHOTOS;
}

export async function startIntakeSession({
  ipAddress,
}: {
  ipAddress: string;
}): Promise<IntakeSessionView> {
  const decision = await consumeSessionCreationBudget(ipAddress);

  if (!decision.allowed) {
    throw new AppError("RATE_LIMITED", describeRateLimit(decision));
  }

  const sessionId = randomUUID();
  const resumeToken = createResumeToken(sessionId);

  const state = appendMessages(
    parseConversationState(null),
    createMessage("assistant", openingMessage()),
  );

  const session = await prisma.customerSession.create({
    data: {
      id: sessionId,
      resumeToken,
      status: "STARTED",
      conversationState: toPlainJson(state),
      outstandingQuestions: [...OPENING_QUESTION_SEQUENCE],
      lastCustomerMessageAt: new Date(),
      isTestRecord: shouldMarkAsTestRecord(),
    },
    select: { id: true, status: true, outstandingQuestions: true },
  });

  await recordSessionEvent(session.id, "SESSION_CREATED", {
    photoUploadAvailable: isPhotoUploadAvailable(),
  });

  return {
    sessionId: session.id,
    resumeToken,
    status: session.status,
    transcript: visibleTranscript(state),
    outstandingPhotoTypes: isPhotoUploadAvailable()
      ? [...REQUIRED_PHOTO_TYPES]
      : [],
    requestedPhotoTypes: [],
    outstandingQuestions: session.outstandingQuestions,
    locationName: null,
    photoUploadAvailable: isPhotoUploadAvailable(),
    isComplete: false,
    perceptionPending: false,
    pendingDimensionConfirmation: null,
    capturedSummary: {
      photoCount: 0,
      widthInches: null,
      heightInches: null,
      dimensionsConfirmed: false,
      assetType: null,
      issueType: null,
    },
  };
}

interface AuthenticatedSession {
  id: string;
  status: SessionStatus;
  state: ConversationState;
  outstandingQuestions: string[];
  franchiseLocationId: string | null;
  locationName: string | null;
}

export async function authenticateSession({
  sessionId,
  resumeToken,
}: {
  sessionId: string;
  resumeToken: string;
}): Promise<AuthenticatedSession> {
  const verified = verifyResumeToken(resumeToken);

  if (!verified || verified.sessionId !== sessionId) {
    throw new AppError("UNAUTHENTICATED", "That estimate link is not valid.");
  }

  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      resumeToken: true,
      conversationState: true,
      outstandingQuestions: true,
      franchiseLocationId: true,
      franchiseLocation: { select: { name: true } },
    },
  });

  if (!session || session.resumeToken !== resumeToken) {
    throw new AppError("UNAUTHENTICATED", "That estimate link has expired.");
  }

  return {
    id: session.id,
    status: session.status,
    state: parseConversationState(session.conversationState),
    outstandingQuestions: session.outstandingQuestions,
    franchiseLocationId: session.franchiseLocationId,
    locationName: session.franchiseLocation?.name ?? null,
  };
}

async function persistState({
  sessionId,
  state,
  status,
  outstandingQuestions,
  touchCustomerActivity = true,
}: {
  sessionId: string;
  state: ConversationState;
  status?: SessionStatus;
  outstandingQuestions?: string[];
  touchCustomerActivity?: boolean;
}): Promise<void> {
  await prisma.customerSession.update({
    where: { id: sessionId },
    data: {
      conversationState: toPlainJson(state),
      ...(status ? { status } : {}),
      ...(outstandingQuestions ? { outstandingQuestions } : {}),
      ...(touchCustomerActivity ? { lastCustomerMessageAt: new Date() } : {}),
      abandonedAt: null,
    },
  });
}

async function composeSessionView({
  sessionId,
  resumeToken,
  state,
  status,
  outstandingQuestions,
  locationName,
  isComplete,
}: {
  sessionId: string;
  resumeToken: string;
  state: ConversationState;
  status: SessionStatus;
  outstandingQuestions: string[];
  locationName: string | null;
  isComplete: boolean;
}): Promise<IntakeSessionView> {
  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      requestedPhotoTypes: true,
      declinedPhotoTypes: true,
      photos: { select: { photoType: true } },
      dimensionEstimates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          widthInches: true,
          heightInches: true,
          squareFootage: true,
          customerConfirmed: true,
        },
      },
      classifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { assetType: true, issueType: true },
      },
    },
  });

  const outstandingPhotoTypes =
    isPhotoUploadAvailable() && session
      ? outstandingPhotoTypesFor({
          received: session.photos.map((photo) => photo.photoType),
          requested: session.requestedPhotoTypes,
          declined: session.declinedPhotoTypes,
        })
      : [];

  const latestDimensions = session?.dimensionEstimates[0] ?? null;

  const pendingDimensionConfirmation: DimensionConfirmationPrompt | null =
    latestDimensions &&
    outstandingQuestions.includes(DIMENSION_CONFIRMATION_QUESTION_ID)
      ? {
          widthInches: latestDimensions.widthInches,
          heightInches: latestDimensions.heightInches,
          squareFootage: latestDimensions.squareFootage,
          summary: describeDimensionEstimate(latestDimensions),
        }
      : null;

  return {
    sessionId,
    resumeToken,
    status,
    transcript: visibleTranscript(state),
    outstandingPhotoTypes,
    requestedPhotoTypes: session?.requestedPhotoTypes ?? [],
    outstandingQuestions,
    locationName,
    photoUploadAvailable: isPhotoUploadAvailable(),
    isComplete,
    perceptionPending:
      isPhotoUploadAvailable() &&
      outstandingPhotoTypes.length === 0 &&
      (await perceptionIsPending(sessionId)),
    pendingDimensionConfirmation,
    capturedSummary: {
      photoCount: session?.photos.length ?? 0,
      widthInches: latestDimensions?.widthInches ?? null,
      heightInches: latestDimensions?.heightInches ?? null,
      dimensionsConfirmed: latestDimensions?.customerConfirmed ?? false,
      assetType: session?.classifications[0]?.assetType ?? null,
      issueType: session?.classifications[0]?.issueType ?? null,
    },
  };
}

export async function recordCustomerMessage({
  sessionId,
  resumeToken,
  message,
}: {
  sessionId: string;
  resumeToken: string;
  message: string;
}): Promise<IntakeSessionView> {
  const session = await authenticateSession({ sessionId, resumeToken });

  const outstandingPhotoTypes =
    await outstandingPhotoTypesForSession(sessionId);

  const answeredNow = questionAnsweredByFreeText(session.outstandingQuestions);
  const remainingQuestions = answeredNow
    ? session.outstandingQuestions.filter((id) => id !== answeredNow)
    : session.outstandingQuestions;

  const wasAlreadyComplete =
    outstandingPhotoTypes.length === 0 &&
    session.outstandingQuestions.length === 0;

  const acknowledgement = buildAcknowledgement({
    outstandingPhotoTypes,
    outstandingQuestions: remainingQuestions,
    isFollowUpAfterCompletion: wasAlreadyComplete,
  });

  const nextState = mergeCollectedDetails(
    appendMessages(
      session.state,
      createMessage("customer", message),
      createMessage("assistant", acknowledgement),
    ),
    answeredNow
      ? {
          answeredQuestionIds: [answeredNow],
          answers: { [answeredNow]: message },
        }
      : {},
  );

  await persistState({
    sessionId,
    state: nextState,
    outstandingQuestions: remainingQuestions,
  });

  await recordSessionEvent(sessionId, "MESSAGE_RECEIVED", {
    characters: message.length,
    answered: answeredNow,
    outstandingPhotos: outstandingPhotoTypes.length,
    outstandingQuestions: remainingQuestions.length,
  });

  const completion = await syncIfIntakeComplete(sessionId);

  return composeSessionView({
    sessionId,
    resumeToken,
    state: nextState,
    status: completion.status ?? session.status,
    outstandingQuestions: remainingQuestions,
    locationName: session.locationName,
    isComplete: completion.isComplete,
  });
}

export async function recordContactDetails({
  sessionId,
  resumeToken,
  name,
  phone,
  email,
  serviceAddress,
}: {
  sessionId: string;
  resumeToken: string;
  name: string;
  phone: string;
  email: string | null;
  serviceAddress: string;
}): Promise<IntakeSessionWithRouting> {
  const session = await authenticateSession({ sessionId, resumeToken });

  const routing = await resolveFranchiseLocation({ serviceAddress });
  const routedLocation = routedLocationOf(routing);
  const routedLocationId = routedLocation?.id ?? null;
  const routingNote = describeRoutingResult(routing);

  const outstandingPhotoTypes =
    await outstandingPhotoTypesForSession(sessionId);

  const acknowledgement = routedLocation
    ? `Thanks. Your job will be handled by ${routedLocation.name}.`
    : "Thanks. One of our team will confirm which of our locations covers that address.";

  const nextStep =
    outstandingPhotoTypes.length > 0
      ? ` Now ${PHOTO_TYPE_GUIDANCE[outstandingPhotoTypes[0]].instruction.toLowerCase()}`
      : " Tell me what happened to the glass in your own words.";

  const nextState = mergeCollectedDetails(
    appendMessages(
      session.state,
      createMessage(
        "customer",
        `${name} · ${phone}${email ? ` · ${email}` : ""} · ${serviceAddress}`,
      ),
      createMessage("assistant", `${acknowledgement}${nextStep}`),
      createMessage("system", `routing: ${routingNote}`),
    ),
    { name, phone: normalizePhone(phone), email, serviceAddress },
  );

  const remainingQuestions = session.outstandingQuestions.filter(
    (id) => id !== "CONTACT_DETAILS" && id !== "SERVICE_ADDRESS",
  );

  await prisma.customerSession.update({
    where: { id: sessionId },
    data: {
      customerName: name,
      customerPhone: normalizePhone(phone),
      customerEmail: email,
      serviceAddress,
      franchiseLocationId: routedLocationId,
      conversationState: toPlainJson(nextState),
      outstandingQuestions: remainingQuestions,
      status: routedLocationId ? session.status : "NEEDS_CALLBACK",
      lastCustomerMessageAt: new Date(),
      abandonedAt: null,
    },
  });

  await recordSessionEvent(sessionId, "CONTACT_CAPTURED", {
    hasEmail: email !== null,
  });
  await recordSessionEvent(sessionId, "ROUTING_RESOLVED", {
    outcome: routing.outcome,
    locationId: routedLocationId,
  });

  const completion = await syncIfIntakeComplete(sessionId);

  const view = await composeSessionView({
    sessionId,
    resumeToken,
    state: nextState,
    status:
      completion.status ??
      (routedLocationId ? session.status : "NEEDS_CALLBACK"),
    outstandingQuestions: remainingQuestions,
    locationName: routedLocation?.name ?? null,
    isComplete: completion.isComplete,
  });

  return { ...view, routingNote };
}

export async function recordPhotoReceived({
  sessionId,
  resumeToken,
  photoType,
}: {
  sessionId: string;
  resumeToken: string;
  photoType: PhotoType;
}): Promise<IntakeSessionView> {
  const session = await authenticateSession({ sessionId, resumeToken });
  const outstandingPhotoTypes =
    await outstandingPhotoTypesForSession(sessionId);

  const nextMessage =
    outstandingPhotoTypes.length === 0
      ? LOOKING_AT_PHOTOS_MESSAGE
      : `Got it. Now ${PHOTO_TYPE_GUIDANCE[outstandingPhotoTypes[0]].instruction.toLowerCase()}`;

  const nextState = appendMessages(
    session.state,
    createMessage(
      "system",
      `photo received: ${PHOTO_TYPE_GUIDANCE[photoType].label}`,
    ),
    createMessage("assistant", nextMessage),
  );

  const status: SessionStatus =
    outstandingPhotoTypes.length === 0 ? "PHOTOS_RECEIVED" : session.status;

  await persistState({ sessionId, state: nextState, status });

  await recordSessionEvent(sessionId, "PHOTO_UPLOADED", {
    photoType,
    stillOutstanding: outstandingPhotoTypes.length,
  });

  const completion = await syncIfIntakeComplete(sessionId);

  return composeSessionView({
    sessionId,
    resumeToken,
    state: nextState,
    status: completion.status ?? status,
    outstandingQuestions: session.outstandingQuestions,
    locationName: session.locationName,
    isComplete: completion.isComplete,
  });
}

function describeObservation(summary: PerceptionSummary): string {
  const { classification } = summary;

  if (!classification) return PERCEPTION_UNAVAILABLE_MESSAGE;

  return (
    classification.reasoning?.trim() ||
    "I have had a look at your photos and passed what I can see to our team."
  );
}

function perceptionReplies(summary: PerceptionSummary): {
  messages: string[];
  asksForDimensionConfirmation: boolean;
} {
  const messages = [describeObservation(summary)];

  if (summary.requestCornerCloseUp) {
    messages.push(CORNER_CLOSEUP_REQUEST_MESSAGE);
    return { messages, asksForDimensionConfirmation: false };
  }

  if (summary.dimensions) {
    messages.push(
      `${describeDimensionEstimate(summary.dimensions)} ${QUESTION_BANK.DIMENSION_CONFIRMATION.prompt}`,
    );
    return { messages, asksForDimensionConfirmation: true };
  }

  messages.push(NO_SCALE_REFERENCE_MESSAGE);
  return { messages, asksForDimensionConfirmation: false };
}

export async function analyzeSessionPhotos({
  sessionId,
  resumeToken,
}: {
  sessionId: string;
  resumeToken: string;
}): Promise<IntakeSessionView> {
  const session = await authenticateSession({ sessionId, resumeToken });

  const outcome = await runPerceptionForSession(sessionId);

  if (outcome.status !== "COMPLETED") {
    const customerIsWaiting =
      outcome.status === "FAILED" || outcome.customerIsWaiting;

    if (!customerIsWaiting) {
      const completion = await syncIfIntakeComplete(sessionId);

      return composeSessionView({
        sessionId,
        resumeToken,
        state: session.state,
        status: completion.status ?? session.status,
        outstandingQuestions: session.outstandingQuestions,
        locationName: session.locationName,
        isComplete: completion.isComplete,
      });
    }

    const nextState = appendMessages(
      session.state,
      createMessage("assistant", PERCEPTION_UNAVAILABLE_MESSAGE),
    );

    await prisma.customerSession.update({
      where: { id: sessionId },
      data: { shouldBypassPricing: true },
    });

    await persistState({
      sessionId,
      state: nextState,
      status: "NEEDS_CALLBACK",
      outstandingQuestions: session.outstandingQuestions,
      touchCustomerActivity: false,
    });

    const completion = await syncIfIntakeComplete(sessionId);

    return composeSessionView({
      sessionId,
      resumeToken,
      state: nextState,
      status: completion.status ?? "NEEDS_CALLBACK",
      outstandingQuestions: session.outstandingQuestions,
      locationName: session.locationName,
      isComplete: completion.isComplete,
    });
  }

  const { summary } = outcome;
  const { messages, asksForDimensionConfirmation } = perceptionReplies(summary);

  const spoken: ChatMessage[] = messages.map((content) =>
    createMessage("assistant", content),
  );

  const nextState = appendMessages(session.state, ...spoken);

  const outstandingQuestions = asksForDimensionConfirmation
    ? [
        ...new Set([
          ...session.outstandingQuestions,
          DIMENSION_CONFIRMATION_QUESTION_ID,
        ]),
      ]
    : session.outstandingQuestions;

  if (summary.requestCornerCloseUp) {
    await prisma.customerSession.update({
      where: { id: sessionId },
      data: { requestedPhotoTypes: { push: CONDITIONAL_PHOTO_TYPE } },
    });

    await recordSessionEvent(sessionId, "EXTRA_PHOTO_REQUESTED", {
      photoType: CONDITIONAL_PHOTO_TYPE,
      problems: summary.photoQuality?.problems ?? [],
    });
  }

  await persistState({
    sessionId,
    state: nextState,
    status: summary.shouldBypassPricing ? "NEEDS_CALLBACK" : "QUESTIONING",
    outstandingQuestions,
    touchCustomerActivity: false,
  });

  const completion = await syncIfIntakeComplete(sessionId);

  return composeSessionView({
    sessionId,
    resumeToken,
    state: nextState,
    status:
      completion.status ??
      (summary.shouldBypassPricing ? "NEEDS_CALLBACK" : "QUESTIONING"),
    outstandingQuestions,
    locationName: session.locationName,
    isComplete: completion.isComplete,
  });
}

export type DimensionConfirmationResponse =
  "CONFIRMED" | "CORRECTED" | "UNSURE";

export async function recordDimensionConfirmation({
  sessionId,
  resumeToken,
  response,
  widthInches,
  heightInches,
}: {
  sessionId: string;
  resumeToken: string;
  response: DimensionConfirmationResponse;
  widthInches: number | null;
  heightInches: number | null;
}): Promise<IntakeSessionView> {
  const session = await authenticateSession({ sessionId, resumeToken });

  const estimate = await prisma.dimensionEstimate.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: { id: true, widthInches: true, heightInches: true },
  });

  if (!estimate) {
    throw new AppError(
      "VALIDATION_FAILED",
      "There is no measurement to confirm on this estimate yet.",
    );
  }

  if (response === "CORRECTED" && (!widthInches || !heightInches)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Give both a width and a height, in inches or feet.",
    );
  }

  await prisma.dimensionEstimate.update({
    where: { id: estimate.id },
    data: {
      customerConfirmed: response === "CONFIRMED",
      customerCorrectedWidth: response === "CORRECTED" ? widthInches : null,
      customerCorrectedHeight: response === "CORRECTED" ? heightInches : null,
    },
  });

  const customerWords =
    response === "CONFIRMED"
      ? "That sounds right."
      : response === "CORRECTED"
        ? `It is about ${widthInches} by ${heightInches} inches.`
        : "I am not sure.";

  const reply =
    response === "CORRECTED"
      ? "Thank you — I have replaced my estimate with your measurement."
      : response === "CONFIRMED"
        ? "Thank you. A glazier will still check it on site before ordering."
        : "No problem. A glazier will measure it when they visit.";

  const nextState = mergeCollectedDetails(
    appendMessages(
      session.state,
      createMessage("customer", customerWords),
      createMessage("assistant", reply),
    ),
    {
      answeredQuestionIds: [DIMENSION_CONFIRMATION_QUESTION_ID],
      answers: { [DIMENSION_CONFIRMATION_QUESTION_ID]: customerWords },
    },
  );

  const remainingQuestions = session.outstandingQuestions.filter(
    (id) => id !== DIMENSION_CONFIRMATION_QUESTION_ID,
  );

  await persistState({
    sessionId,
    state: nextState,
    outstandingQuestions: remainingQuestions,
  });

  await recordSessionEvent(sessionId, "DIMENSIONS_CONFIRMED", {
    response,
    widthInches,
    heightInches,
    estimatedWidthInches: estimate.widthInches,
    estimatedHeightInches: estimate.heightInches,
  });

  const completion = await syncIfIntakeComplete(sessionId);

  return composeSessionView({
    sessionId,
    resumeToken,
    state: nextState,
    status: completion.status ?? session.status,
    outstandingQuestions: remainingQuestions,
    locationName: session.locationName,
    isComplete: completion.isComplete,
  });
}

export async function declineRequestedPhoto({
  sessionId,
  resumeToken,
  photoType,
}: {
  sessionId: string;
  resumeToken: string;
  photoType: PhotoType;
}): Promise<IntakeSessionView> {
  const session = await authenticateSession({ sessionId, resumeToken });

  if (REQUIRED_PHOTO_TYPES.includes(photoType)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "That photo is one of the two we always need.",
    );
  }

  await prisma.customerSession.update({
    where: { id: sessionId },
    data: { declinedPhotoTypes: { push: photoType } },
  });

  const nextState = appendMessages(
    session.state,
    createMessage("customer", "I cannot get that photo."),
    createMessage(
      "assistant",
      "That is fine. I have noted it so the glazier checks the frame on site.",
    ),
  );

  await persistState({ sessionId, state: nextState });

  await recordSessionEvent(sessionId, "EXTRA_PHOTO_DECLINED", { photoType });

  const completion = await syncIfIntakeComplete(sessionId);

  return composeSessionView({
    sessionId,
    resumeToken,
    state: nextState,
    status: completion.status ?? session.status,
    outstandingQuestions: session.outstandingQuestions,
    locationName: session.locationName,
    isComplete: completion.isComplete,
  });
}

interface CompletionAttempt {
  isComplete: boolean;
  status: SessionStatus | null;
}

async function syncIfIntakeComplete(
  sessionId: string,
): Promise<CompletionAttempt> {
  const { isComplete } = await assessSessionCompleteness(sessionId);

  if (!isComplete) return { isComplete: false, status: null };

  const existing = await prisma.estimate.findUnique({
    where: { sessionId },
    select: { housecallProEstimateId: true, status: true },
  });

  if (existing?.housecallProEstimateId) {
    return { isComplete: true, status: "SYNCED" };
  }

  if (existing?.status === "SYNC_FAILED") {
    return { isComplete: true, status: null };
  }

  const outcome = await syncSessionToHousecallPro({
    sessionId,
    reason: "COMPLETED_INTAKE",
  });

  const synced =
    outcome.status === "SYNCED" || outcome.status === "ALREADY_SYNCED";

  return { isComplete: true, status: synced ? "SYNCED" : null };
}

async function outstandingPhotoTypesForSession(
  sessionId: string,
): Promise<PhotoType[]> {
  if (!isPhotoUploadAvailable()) return [];

  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      requestedPhotoTypes: true,
      declinedPhotoTypes: true,
      photos: { select: { photoType: true } },
    },
  });

  if (!session) return [...REQUIRED_PHOTO_TYPES];

  return outstandingPhotoTypesFor({
    received: session.photos.map((photo) => photo.photoType),
    requested: session.requestedPhotoTypes,
    declined: session.declinedPhotoTypes,
  });
}

function questionAnsweredByFreeText(
  outstandingQuestions: readonly string[],
): string | null {
  return (
    outstandingQuestions.find(
      (id) =>
        id in QUESTION_BANK &&
        !(QUESTIONS_NOT_ANSWERABLE_BY_FREE_TEXT as readonly string[]).includes(
          id,
        ),
    ) ?? null
  );
}

const FOLLOW_UP_AFTER_COMPLETION =
  "Thanks — I have added that to your job and flagged it for the glazier. Your details are already with the team, so they will see this before they price the work.";

function buildAcknowledgement({
  outstandingPhotoTypes,
  outstandingQuestions,
  isFollowUpAfterCompletion,
}: {
  outstandingPhotoTypes: readonly PhotoType[];
  outstandingQuestions: readonly string[];
  isFollowUpAfterCompletion: boolean;
}): string {
  if (isFollowUpAfterCompletion) return FOLLOW_UP_AFTER_COMPLETION;

  if (outstandingPhotoTypes.length > 0) {
    return `Thanks. I still need one photo: ${PHOTO_TYPE_GUIDANCE[outstandingPhotoTypes[0]].instruction}`;
  }

  const nextQuestionId = outstandingQuestions.find(
    (id) =>
      id in QUESTION_BANK &&
      !(FORM_ANSWERED_QUESTION_IDS as readonly string[]).includes(id),
  );

  if (nextQuestionId) {
    const question =
      QUESTION_BANK[nextQuestionId as keyof typeof QUESTION_BANK];
    return question.helper
      ? `${question.prompt}

${question.helper}`
      : question.prompt;
  }

  if (
    outstandingQuestions.some((id) =>
      (FORM_ANSWERED_QUESTION_IDS as readonly string[]).includes(id),
    )
  ) {
    return `${QUESTION_BANK.CONTACT_DETAILS.prompt}

${QUESTION_BANK.CONTACT_DETAILS.helper}`;
  }

  return "Thanks — that is everything I need. Our team will review the details and send your estimate.";
}
