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
import { recordSessionEvent } from "@/modules/intake/session-events";
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
  routedLocationOf,
} from "@/modules/tenancy/territory-routing";

const OPENING_MESSAGE_WITH_PHOTOS = [
  "Hi — I can get you an estimate for glass repair or replacement.",
  "",
  "First, your name, phone number and the address where the work is needed. That way we can still reach you if anything interrupts us.",
  "",
  "Then I will ask for two photos, read the size from them and ask you to check it. A glazier prices the work and sends you the estimate.",
].join("\n");

const OPENING_MESSAGE_WITHOUT_PHOTOS = [
  "Hi — I can get your glass repair or replacement in front of our team.",
  "",
  "Photo upload is not switched on yet. Start with your name, phone number and the service address, then tell me what happened in your own words. A glazier will follow up to measure and price the work.",
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

  const answeredNow = questionAnsweredByFreeText(session.outstandingQuestions);
  const remainingQuestions = answeredNow
    ? session.outstandingQuestions.filter((id) => id !== answeredNow)
    : session.outstandingQuestions;

  const acknowledgement = buildAcknowledgement({
    outstandingPhotoTypes,
    outstandingQuestions: remainingQuestions,
  });

  const nextState = mergeCollectedDetails(
    appendMessages(
      session.state,
      createMessage("customer", message),
      createMessage("assistant", acknowledgement),
    ),
    answeredNow ? { answeredQuestionIds: [answeredNow] } : {},
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

  return {
    sessionId,
    resumeToken,
    status: session.status,
    transcript: visibleTranscript(nextState),
    outstandingPhotoTypes,
    outstandingQuestions: remainingQuestions,
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
  const routedLocation = routedLocationOf(routing);
  const routedLocationId = routedLocation?.id ?? null;
  const routingNote = describeRoutingResult(routing);

  const outstandingPhotoTypes = await outstandingPhotoTypesFor(sessionId);

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

  return {
    sessionId,
    resumeToken,
    status: routedLocationId ? session.status : "NEEDS_CALLBACK",
    transcript: visibleTranscript(nextState),
    outstandingPhotoTypes,
    outstandingQuestions: remainingQuestions,
    locationName: routedLocation?.name ?? null,
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
      ? "Got both photos, thank you. Tell me what happened to the glass in your own words."
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

const QUESTIONS_ANSWERED_BY_THE_CONTACT_FORM: readonly string[] = [
  "CONTACT_DETAILS",
  "SERVICE_ADDRESS",
];

function questionAnsweredByFreeText(
  outstandingQuestions: readonly string[],
): string | null {
  if (outstandingQuestions.includes("CONTACT_DETAILS")) return null;

  return (
    outstandingQuestions.find(
      (id) =>
        id in QUESTION_BANK &&
        !QUESTIONS_ANSWERED_BY_THE_CONTACT_FORM.includes(id),
    ) ?? null
  );
}

function buildAcknowledgement({
  outstandingPhotoTypes,
  outstandingQuestions,
}: {
  outstandingPhotoTypes: readonly PhotoType[];
  outstandingQuestions: readonly string[];
}): string {
  if (outstandingQuestions.includes("CONTACT_DETAILS")) {
    return `${QUESTION_BANK.CONTACT_DETAILS.prompt}\n\n${QUESTION_BANK.CONTACT_DETAILS.helper}`;
  }

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
