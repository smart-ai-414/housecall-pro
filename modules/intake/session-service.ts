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
  type ConversationState,
} from "@/modules/intake/conversation-state";
import {
  OPENING_QUESTION_SEQUENCE,
  QUESTION_BANK,
} from "@/modules/intake/question-bank";
import { shouldMarkAsTestRecord } from "@/modules/housecall-pro/test-guard";
import {
  isPhotoUploadAvailable,
  PHOTO_TYPE_GUIDANCE,
  REQUIRED_PHOTO_TYPES,
} from "@/modules/photos/photo-service";
import type {
  IntakeSessionView,
  IntakeSessionWithRouting,
} from "@/modules/intake/types";
import {
  describeRoutingResult,
  resolveFranchiseLocation,
} from "@/modules/tenancy/territory-routing";

const OPENING_MESSAGE_WITH_PHOTOS = [
  "Hi — I can get you an estimate for glass repair or replacement.",
  "",
  `To start, send me two photos: ${PHOTO_TYPE_GUIDANCE.INTERIOR_FLOOR_TO_CEILING.instruction} Then ${PHOTO_TYPE_GUIDANCE.EXTERIOR_FULL_ELEVATION.instruction.toLowerCase()}`,
  "",
  "I will read the size from the photos and ask you to check it. A glazier prices the work and sends you the estimate.",
].join("\n");

const OPENING_MESSAGE_WITHOUT_PHOTOS = [
  "Hi — I can get your glass repair or replacement in front of our team.",
  "",
  "Photo upload is not switched on yet, so tell me what happened in your own words and I will take your details. A glazier will follow up to measure and price the work.",
].join("\n");

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

  return {
    sessionId: session.id,
    resumeToken,
    status: session.status,
    transcript: visibleTranscript(state),
    outstandingPhotoTypes: isPhotoUploadAvailable()
      ? [...REQUIRED_PHOTO_TYPES]
      : [],
    outstandingQuestions: session.outstandingQuestions,
    locationName: null,
    photoUploadAvailable: isPhotoUploadAvailable(),
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

  const outstandingPhotoTypes = await outstandingPhotoTypesFor(sessionId);
  const acknowledgement = buildAcknowledgement({
    outstandingPhotoTypes,
    outstandingQuestions: session.outstandingQuestions,
  });

  const nextState = appendMessages(
    session.state,
    createMessage("customer", message),
    createMessage("assistant", acknowledgement),
  );

  await persistState({ sessionId, state: nextState });

  return {
    sessionId,
    resumeToken,
    status: session.status,
    transcript: visibleTranscript(nextState),
    outstandingPhotoTypes,
    outstandingQuestions: session.outstandingQuestions,
    locationName: session.locationName,
    photoUploadAvailable: isPhotoUploadAvailable(),
  };
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
  const routedLocationId =
    routing.outcome === "ROUTED" ? routing.location.id : null;
  const routingNote = describeRoutingResult(routing);

  const nextState = mergeCollectedDetails(
    appendMessages(
      session.state,
      createMessage(
        "customer",
        `${name} · ${phone}${email ? ` · ${email}` : ""} · ${serviceAddress}`,
      ),
      createMessage(
        "assistant",
        routedLocationId
          ? `Thanks. Your job will be handled by ${routing.outcome === "ROUTED" ? routing.location.name : "our nearest branch"}.`
          : "Thanks. One of our team will confirm which of our locations covers that address.",
      ),
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

  return {
    sessionId,
    resumeToken,
    status: routedLocationId ? session.status : "NEEDS_CALLBACK",
    transcript: visibleTranscript(nextState),
    outstandingPhotoTypes: await outstandingPhotoTypesFor(sessionId),
    outstandingQuestions: remainingQuestions,
    locationName: routing.outcome === "ROUTED" ? routing.location.name : null,
    photoUploadAvailable: isPhotoUploadAvailable(),
    routingNote,
  };
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
  const outstandingPhotoTypes = await outstandingPhotoTypesFor(sessionId);

  const nextMessage =
    outstandingPhotoTypes.length === 0
      ? "Got both photos, thank you. Next I need your contact details and the service address."
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

  return {
    sessionId,
    resumeToken,
    status,
    transcript: visibleTranscript(nextState),
    outstandingPhotoTypes,
    outstandingQuestions: session.outstandingQuestions,
    locationName: session.locationName,
    photoUploadAvailable: isPhotoUploadAvailable(),
  };
}

async function outstandingPhotoTypesFor(
  sessionId: string,
): Promise<PhotoType[]> {
  if (!isPhotoUploadAvailable()) return [];

  const received = await prisma.sessionPhoto.findMany({
    where: { sessionId },
    select: { photoType: true },
  });

  const receivedTypes = new Set(received.map((photo) => photo.photoType));
  return REQUIRED_PHOTO_TYPES.filter((type) => !receivedTypes.has(type));
}

function buildAcknowledgement({
  outstandingPhotoTypes,
  outstandingQuestions,
}: {
  outstandingPhotoTypes: readonly PhotoType[];
  outstandingQuestions: readonly string[];
}): string {
  if (outstandingPhotoTypes.length > 0) {
    return `Thanks. I still need one photo: ${PHOTO_TYPE_GUIDANCE[outstandingPhotoTypes[0]].instruction}`;
  }

  const nextQuestionId = outstandingQuestions.find((id) => id in QUESTION_BANK);

  if (nextQuestionId) {
    const question =
      QUESTION_BANK[nextQuestionId as keyof typeof QUESTION_BANK];
    return question.helper
      ? `${question.prompt}\n\n${question.helper}`
      : question.prompt;
  }

  return "Thanks — that is everything I need. Our team will review the details and send your estimate.";
}
