import type { CapturedSummary, IntakeSessionView } from "@/modules/intake/types";

export const INTAKE_STAGES = [
  "PHOTOS",
  "MEASUREMENTS",
  "DETAILS",
  "CONTACT",
] as const;

export type IntakeStage = (typeof INTAKE_STAGES)[number];

export const INTAKE_STAGE_LABELS: Record<IntakeStage, string> = {
  PHOTOS: "Photos",
  MEASUREMENTS: "Measurements",
  DETAILS: "Details",
  CONTACT: "Contact",
};

const FORM_ANSWERED_QUESTION_IDS = ["CONTACT_DETAILS", "SERVICE_ADDRESS"];

function isFormAnswered(questionId: string): boolean {
  return FORM_ANSWERED_QUESTION_IDS.includes(questionId);
}

export function stageForSession(session: IntakeSessionView): IntakeStage {
  if (session.outstandingPhotoTypes.length > 0 || session.perceptionPending) {
    return "PHOTOS";
  }

  if (session.pendingDimensionConfirmation !== null) return "MEASUREMENTS";

  const questionsBesidesContact = session.outstandingQuestions.filter(
    (id) => !isFormAnswered(id),
  );

  if (questionsBesidesContact.length > 0) return "DETAILS";

  return "CONTACT";
}

export function stageIndexForSession(session: IntakeSessionView): number {
  return INTAKE_STAGES.indexOf(stageForSession(session));
}

export function needsContactDetails(session: IntakeSessionView): boolean {
  return (
    session.outstandingQuestions.some(isFormAnswered) &&
    stageForSession(session) === "CONTACT"
  );
}

export function remainingQuestionCount(session: IntakeSessionView): number {
  return session.outstandingQuestions.filter((id) => !isFormAnswered(id))
    .length;
}

function humanizeEnumValue(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface CapturedFact {
  label: string;
  value: string;
}

export function capturedFacts(summary: CapturedSummary): CapturedFact[] {
  const facts: CapturedFact[] = [];

  if (summary.photoCount > 0) {
    facts.push({
      label: "Photos",
      value: `${summary.photoCount} received`,
    });
  }

  if (summary.widthInches !== null && summary.heightInches !== null) {
    const size = `${Math.round(summary.widthInches)} × ${Math.round(summary.heightInches)} in`;
    facts.push({
      label: "Opening",
      value: summary.dimensionsConfirmed ? `${size} · confirmed` : size,
    });
  }

  if (summary.assetType !== null) {
    facts.push({
      label: "Job",
      value:
        summary.issueType !== null
          ? `${humanizeEnumValue(summary.assetType)} · ${humanizeEnumValue(summary.issueType).toLowerCase()}`
          : humanizeEnumValue(summary.assetType),
    });
  }

  return facts;
}
