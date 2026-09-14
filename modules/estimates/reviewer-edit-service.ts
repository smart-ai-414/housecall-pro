import { prisma } from "@/core/db/prisma";
import { AppError } from "@/core/errors";
import type { ReviewerEditField } from "@/modules/estimates/reviewer-edit-fields";

export * from "@/modules/estimates/reviewer-edit-fields";

export interface ReviewerEditInput {
  estimateId: string;
  reviewerUserId: string;
  fieldChanged: ReviewerEditField;
  newValue: string;
}

interface ObservedValues {
  assetType: string | null;
  issueType: string | null;
  frameMaterialHint: string | null;
  widthInches: number | null;
  heightInches: number | null;
}

async function readObservedValues(
  estimateId: string,
): Promise<ObservedValues | null> {
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    select: {
      session: {
        select: {
          classifications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              assetType: true,
              issueType: true,
              frameMaterialHint: true,
            },
          },
          dimensionEstimates: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { widthInches: true, heightInches: true },
          },
        },
      },
    },
  });

  if (!estimate) return null;

  const classification = estimate.session.classifications[0] ?? null;
  const dimensions = estimate.session.dimensionEstimates[0] ?? null;

  return {
    assetType: classification?.assetType ?? null,
    issueType: classification?.issueType ?? null,
    frameMaterialHint: classification?.frameMaterialHint ?? null,
    widthInches: dimensions?.widthInches ?? null,
    heightInches: dimensions?.heightInches ?? null,
  };
}

function originalValueFor(
  field: ReviewerEditField,
  observed: ObservedValues,
): string | null {
  switch (field) {
    case "assetType":
      return observed.assetType;
    case "issueType":
      return observed.issueType;
    case "frameMaterialHint":
      return observed.frameMaterialHint;
    case "widthInches":
      return observed.widthInches === null
        ? null
        : String(Math.round(observed.widthInches));
    case "heightInches":
      return observed.heightInches === null
        ? null
        : String(Math.round(observed.heightInches));
    case "serviceItem":
    case "other":
      return null;
  }
}

export async function recordReviewerEdit({
  estimateId,
  reviewerUserId,
  fieldChanged,
  newValue,
}: ReviewerEditInput): Promise<{ id: string }> {
  const observed = await readObservedValues(estimateId);

  if (!observed) {
    throw new AppError("NOT_FOUND", "That estimate does not exist.");
  }

  const edit = await prisma.reviewerEdit.create({
    data: {
      estimateId,
      reviewerUserId,
      fieldChanged,
      originalValue: originalValueFor(fieldChanged, observed),
      newValue,
    },
    select: { id: true },
  });

  console.info(
    `[reviewer-edit] estimate ${estimateId} ${fieldChanged} corrected by ${reviewerUserId}`,
  );

  return edit;
}

export interface ReviewerEditRow {
  id: string;
  fieldChanged: string;
  originalValue: string | null;
  newValue: string | null;
  reviewerName: string;
  createdAt: Date;
}

export async function listReviewerEdits(
  estimateId: string,
): Promise<ReviewerEditRow[]> {
  const edits = await prisma.reviewerEdit.findMany({
    where: { estimateId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fieldChanged: true,
      originalValue: true,
      newValue: true,
      createdAt: true,
      reviewer: { select: { name: true } },
    },
  });

  return edits.map((edit) => ({
    id: edit.id,
    fieldChanged: edit.fieldChanged,
    originalValue: edit.originalValue,
    newValue: edit.newValue,
    reviewerName: edit.reviewer.name,
    createdAt: edit.createdAt,
  }));
}
