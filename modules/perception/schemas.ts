import { z } from "zod";

export const assetTypeSchema = z.enum([
  "RESIDENTIAL_WINDOW",
  "SLIDING_DOOR",
  "SHOWER_GLASS",
  "COMMERCIAL_STOREFRONT",
  "DOOR_GLASS",
  "MIRROR",
  "UNKNOWN",
]);

export const issueTypeSchema = z.enum([
  "CRACKED",
  "SHATTERED",
  "SEAL_FAILURE",
  "SCRATCHED",
  "HARDWARE_OR_FRAME",
  "OTHER",
  "UNKNOWN",
]);

export const frameMaterialSchema = z.enum([
  "VINYL",
  "ALUMINIUM",
  "WOOD",
  "FIBREGLASS",
  "UNKNOWN",
]);

export const photoQualitySchema = z.enum([
  "GOOD",
  "ADEQUATE",
  "POOR",
  "UNUSABLE",
]);

export const scaleReferenceSchema = z.enum([
  "HEAD_HEIGHT",
  "BRICK_COURSING",
  "INTERIOR_FIXTURE",
  "DELIBERATE_SCALE_OBJECT",
  "FRAME_FACE",
]);

export type AssetType = z.infer<typeof assetTypeSchema>;
export type IssueType = z.infer<typeof issueTypeSchema>;
export type FrameMaterial = z.infer<typeof frameMaterialSchema>;
export type PhotoQuality = z.infer<typeof photoQualitySchema>;
export type ScaleReference = z.infer<typeof scaleReferenceSchema>;

const confidenceSchema = z.number().min(0).max(1);

export const classificationResultSchema = z.object({
  assetType: assetTypeSchema,
  issueType: issueTypeSchema,
  frameMaterialHint: frameMaterialSchema.default("UNKNOWN"),
  confidence: confidenceSchema,
  reasoning: z.string().max(1000).optional(),
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

export const dimensionResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ESTIMATED"),
    widthInches: z.number().positive().max(400),
    heightInches: z.number().positive().max(400),
    scaleReferenceUsed: scaleReferenceSchema,
    confidence: confidenceSchema,
    reasoning: z.string().max(1000).optional(),
  }),
  z.object({
    status: z.literal("NO_REFERENCE_FOUND"),
    reasoning: z.string().max(1000).optional(),
  }),
]);

export type DimensionResult = z.infer<typeof dimensionResultSchema>;

export const photoQualityResultSchema = z.object({
  overall: photoQualitySchema,
  problems: z.array(z.string().max(200)).max(10).default([]),
  shouldRequestCornerCloseUp: z.boolean().default(false),
});

export type PhotoQualityResult = z.infer<typeof photoQualityResultSchema>;

export const SCALE_REFERENCE_RANK: Record<ScaleReference, number> = {
  HEAD_HEIGHT: 1,
  BRICK_COURSING: 2,
  INTERIOR_FIXTURE: 3,
  DELIBERATE_SCALE_OBJECT: 4,
  FRAME_FACE: 5,
};

export const PROVISIONAL_LOW_CONFIDENCE_THRESHOLD = 0.7;

export function squareFootageOf(
  widthInches: number,
  heightInches: number,
): number {
  return (widthInches * heightInches) / 144;
}

export function isLowConfidence(
  confidence: number,
  threshold = PROVISIONAL_LOW_CONFIDENCE_THRESHOLD,
): boolean {
  return confidence < threshold;
}

export function classificationIsUsable(result: ClassificationResult): boolean {
  return (
    result.assetType !== "UNKNOWN" &&
    result.issueType !== "UNKNOWN" &&
    !isLowConfidence(result.confidence)
  );
}
