import type {
  ClassificationResult,
  DimensionResult,
  PhotoQualityResult,
} from "@/modules/perception/schemas";

export interface PerceptionPhoto {
  label: string;
  contentType: string;
  data: Buffer;
}

export interface PerceptionInput {
  photos: readonly PerceptionPhoto[];
  customerDescription: string;
}

export interface DimensionInput extends PerceptionInput {
  assetType: string;
}

export interface PerceptionProvider {
  readonly name: string;
  classify(input: PerceptionInput): Promise<ClassificationResult>;
  estimateDimensions(input: DimensionInput): Promise<DimensionResult>;
  assessPhotoQuality(input: PerceptionInput): Promise<PhotoQualityResult>;
}

export type PerceptionFunction =
  "classify" | "estimateDimensions" | "assessPhotoQuality";

export type PerceptionOutcome<T> =
  | { status: "OK"; value: T; provider: string; attempts: number }
  | { status: "FAILED"; reason: string; provider: string; attempts: number };

export class PerceptionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerceptionUnavailableError";
  }
}
