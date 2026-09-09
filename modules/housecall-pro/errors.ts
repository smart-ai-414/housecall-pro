export type HousecallProFailureKind =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION_REJECTED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNEXPECTED_RESPONSE";

export class HousecallProError extends Error {
  readonly kind: HousecallProFailureKind;
  readonly status: number | null;
  readonly responseBody: string | null;
  readonly retryable: boolean;

  constructor({
    kind,
    message,
    status = null,
    responseBody = null,
  }: {
    kind: HousecallProFailureKind;
    message: string;
    status?: number | null;
    responseBody?: string | null;
  }) {
    super(message);
    this.name = "HousecallProError";
    this.kind = kind;
    this.status = status;
    this.responseBody = responseBody;
    this.retryable = RETRYABLE_KINDS.has(kind);
  }
}

const RETRYABLE_KINDS = new Set<HousecallProFailureKind>([
  "RATE_LIMITED",
  "SERVER_ERROR",
  "NETWORK_ERROR",
  "TIMEOUT",
]);

export function failureKindForStatus(status: number): HousecallProFailureKind {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 404) return "NOT_FOUND";
  if (status === 409 || status === 422 || status === 400) {
    return "VALIDATION_REJECTED";
  }
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "UNEXPECTED_RESPONSE";
}

export function isAmbiguousFailure(error: unknown): boolean {
  return (
    error instanceof HousecallProError &&
    (error.kind === "TIMEOUT" ||
      error.kind === "NETWORK_ERROR" ||
      error.kind === "SERVER_ERROR")
  );
}
