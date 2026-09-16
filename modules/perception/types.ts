import type {
  DimensionResult,
  ObservationResult,
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
  observe(
    input: PerceptionInput,
  ): Promise<PerceptionObservation<ObservationResult>>;
  estimateDimensions(
    input: DimensionInput,
  ): Promise<PerceptionObservation<DimensionResult>>;
}

export type PerceptionFunction = "observe" | "estimateDimensions";

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

const TRANSIENT_STATUSES = new Set([408, 409, 425, 429]);

export class PerceptionRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PerceptionRequestError";
    this.status = status;
  }
}

function statusOf(error: unknown): number | null {
  if (error instanceof PerceptionRequestError) return error.status;

  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }

  return null;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof PerceptionUnavailableError) return false;

  const status = statusOf(error);
  if (status === null) return true;

  if (status >= 500) return true;
  if (TRANSIENT_STATUSES.has(status)) return true;

  return status < 400;
}

export const REGION_BLOCK_HINT =
  "The provider rejected the request with FAILED_PRECONDITION, which usually means the API key's account region is not supported. Check the key and any proxy configuration before assuming the photographs are at fault.";

export function describeRequestFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes("FAILED_PRECONDITION")
    ? `${message}\n${REGION_BLOCK_HINT}`
    : message;
}
