import { AppError } from "@/core/errors";

const VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5_000;

interface TurnstileVerifyResponse {
  success?: boolean;
  "error-codes"?: string[];
}

export function turnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  return key === "" ? null : key;
}

export function isTurnstileConfigured(): boolean {
  return (
    turnstileSiteKey() !== null &&
    (process.env.TURNSTILE_SECRET_KEY ?? "") !== ""
  );
}

export async function assertTurnstileTokenIsValid(
  token: unknown,
  remoteIp: string,
): Promise<void> {
  if (!isTurnstileConfigured()) return;

  if (typeof token !== "string" || token.trim() === "") {
    throw new AppError(
      "FORBIDDEN",
      "We could not verify that request came from a browser. Reload the page and try again.",
    );
  }

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY ?? "",
    response: token,
  });

  if (remoteIp !== "" && remoteIp !== "unknown") {
    body.set("remoteip", remoteIp);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  let verdict: TurnstileVerifyResponse;
  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    verdict = (await response.json()) as TurnstileVerifyResponse;
  } catch (error) {
    console.warn(
      "[turnstile] verification unreachable, allowing the request",
      error instanceof Error ? error.message : error,
    );
    return;
  } finally {
    clearTimeout(timeout);
  }

  if (verdict.success === true) return;

  console.info(
    `[turnstile] rejected: ${(verdict["error-codes"] ?? []).join(", ") || "no reason given"}`,
  );

  throw new AppError(
    "FORBIDDEN",
    "We could not verify that request came from a browser. Reload the page and try again.",
  );
}
