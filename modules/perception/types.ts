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

export interface PerceptionObservation<T> {
  value: T;
  rawOutput: unknown;
  model: string;
}

export interface PerceptionProvider {
  readonly name: string;
  classify(
    input: PerceptionInput,
  ): Promise<PerceptionObservation<ClassificationResult>>;
  estimateDimensions(
    input: DimensionInput,
  ): Promise<PerceptionObservation<DimensionResult>>;
  assessPhotoQuality(
    input: PerceptionInput,
  ): Promise<PerceptionObservation<PhotoQualityResult>>;
}

export type PerceptionFunction =
  "classify" | "estimateDimensions" | "assessPhotoQuality";

export type PerceptionOutcome<T> =
  | {
      status: "OK";
      value: T;
      rawOutput: unknown;
      model: string;
      provider: string;
      attempts: number;
    }
  | { status: "FAILED"; reason: string; provider: string; attempts: number };

export class PerceptionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerceptionUnavailableError";
  }
}
