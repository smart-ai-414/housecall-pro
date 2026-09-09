import { housecallProEnv } from "@/core/config/env";
import {
  failureKindForStatus,
  HousecallProError,
} from "@/modules/housecall-pro/errors";

export const MAX_ATTEMPTS = 4;
export const REQUEST_TIMEOUT_MS = 20_000;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;
const MIN_REQUEST_SPACING_MS = 120;

export interface HousecallProRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  idempotencyKey?: string;
  attemptLimit?: number;
}

export interface HousecallProClient {
  request<T>(options: HousecallProRequest): Promise<T>;
}

function withoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function withoutLeadingSlash(value: string): string {
  return value.startsWith("/") ? value.slice(1) : value;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const base = withoutTrailingSlash(
    housecallProEnv().HOUSECALL_PRO_API_BASE_URL,
  );
  const url = new URL(`${base}/${withoutLeadingSlash(path)}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function jitteredBackoffMs(attempt: number, retryAfterHeader: string | null) {
  const retryAfterSeconds = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : Number.NaN;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, MAX_BACKOFF_MS);
  }

  const exponential = Math.min(
    BASE_BACKOFF_MS * 2 ** (attempt - 1),
    MAX_BACKOFF_MS,
  );

  return exponential / 2 + Math.random() * (exponential / 2);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBodySafely(response: Response): Promise<string | null> {
  try {
    return (await response.text()).slice(0, 2000);
  } catch {
    return null;
  }
}

export function createHousecallProClient(apiKey: string): HousecallProClient {
  let nextAllowedRequestAt = 0;

  async function throttle(): Promise<void> {
    const now = Date.now();
    if (now < nextAllowedRequestAt) {
      await delay(nextAllowedRequestAt - now);
    }
    nextAllowedRequestAt = Date.now() + MIN_REQUEST_SPACING_MS;
  }

  async function attemptOnce<T>(options: HousecallProRequest): Promise<T> {
    await throttle();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(buildUrl(options.path, options.query), {
        method: options.method,
        headers: {
          Authorization: `Token ${apiKey}`,
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new HousecallProError({
        kind: aborted ? "TIMEOUT" : "NETWORK_ERROR",
        message: aborted
          ? `Housecall Pro did not respond within ${REQUEST_TIMEOUT_MS}ms`
          : "Could not reach Housecall Pro",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await readBodySafely(response);
      throw new HousecallProError({
        kind: failureKindForStatus(response.status),
        message: `Housecall Pro responded ${response.status}`,
        status: response.status,
        responseBody: body,
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new HousecallProError({
        kind: "UNEXPECTED_RESPONSE",
        message: "Housecall Pro returned a body that was not JSON",
        status: response.status,
      });
    }
  }

  return {
    async request<T>(options: HousecallProRequest): Promise<T> {
      const attemptLimit = options.attemptLimit ?? MAX_ATTEMPTS;
      let lastError: unknown;

      for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
        try {
          return await attemptOnce<T>(options);
        } catch (error) {
          lastError = error;

          const isRetryable =
            error instanceof HousecallProError && error.retryable;

          if (!isRetryable || attempt === attemptLimit) break;

          const retryAfter =
            error instanceof HousecallProError && error.status === 429
              ? String(Math.ceil(jitteredBackoffMs(attempt, null) / 1000))
              : null;

          await delay(jitteredBackoffMs(attempt, retryAfter));
        }
      }

      throw lastError;
    },
  };
}
