export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "CONFIGURATION_ERROR",
  "FEATURE_UNAVAILABLE",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  CONFIGURATION_ERROR: 500,
  FEATURE_UNAVAILABLE: 503,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export interface AppErrorShape {
  code: ErrorCode;
  message: string;

  fieldErrors?: Record<string, string[]>;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  toShape(): AppErrorShape {
    return {
      code: this.code,
      message: this.message,
      ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
    };
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }
}
