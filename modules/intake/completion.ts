import { prisma } from "@/core/db/prisma";
import type { PhotoType } from "@/generated/prisma/enums";
import { QUESTION_BANK } from "@/modules/intake/question-bank";
import {
  isPhotoUploadAvailable,
  listOutstandingPhotoTypes,
} from "@/modules/photos/photo-service";

export type MissingRequirement =
  | "CONTACT_DETAILS"
  | "SERVICE_ADDRESS"
  | "FRANCHISE_ROUTING"
  | "PHOTOS"
  | "QUESTIONS";

export interface IntakeCompleteness {
  isComplete: boolean;
  missing: MissingRequirement[];
}

export interface CompletenessInput {
  hasName: boolean;
  hasPhoneOrEmail: boolean;
  hasServiceAddress: boolean;
  isRouted: boolean;
  outstandingPhotoTypes: readonly PhotoType[];
  outstandingQuestions: readonly string[];
}

export function assessIntakeCompleteness(
  input: CompletenessInput,
): IntakeCompleteness {
  const missing: MissingRequirement[] = [];

  if (!input.hasName || !input.hasPhoneOrEmail) missing.push("CONTACT_DETAILS");
  if (!input.hasServiceAddress) missing.push("SERVICE_ADDRESS");
  if (!input.isRouted) missing.push("FRANCHISE_ROUTING");
  if (input.outstandingPhotoTypes.length > 0) missing.push("PHOTOS");

  const unansweredBankedQuestions = input.outstandingQuestions.filter(
    (id) => id in QUESTION_BANK,
  );
  if (unansweredBankedQuestions.length > 0) missing.push("QUESTIONS");

  return { isComplete: missing.length === 0, missing };
}

export async function assessSessionCompleteness(
  sessionId: string,
): Promise<IntakeCompleteness> {
  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      serviceAddress: true,
      franchiseLocationId: true,
      outstandingQuestions: true,
    },
  });

  if (!session) return { isComplete: false, missing: ["CONTACT_DETAILS"] };

  const outstandingPhotoTypes = isPhotoUploadAvailable()
    ? await listOutstandingPhotoTypes(sessionId)
    : [];

  return assessIntakeCompleteness({
    hasName: Boolean(session.customerName),
    hasPhoneOrEmail: Boolean(session.customerPhone ?? session.customerEmail),
    hasServiceAddress: Boolean(session.serviceAddress),
    isRouted: session.franchiseLocationId !== null,
    outstandingPhotoTypes,
    outstandingQuestions: session.outstandingQuestions,
  });
}

export function describeMissingRequirements(
  missing: readonly MissingRequirement[],
): string[] {
  return missing.map((requirement) => {
    switch (requirement) {
      case "CONTACT_DETAILS":
        return "No name or way to contact the customer was captured.";
      case "SERVICE_ADDRESS":
        return "No service address was captured.";
      case "FRANCHISE_ROUTING":
        return "The service address did not route to a franchise location.";
      case "PHOTOS":
        return "Not every requested photo was received.";
      case "QUESTIONS":
        return "The customer left intake questions unanswered.";
    }
  });
}
