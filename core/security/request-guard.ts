import { AppError } from "@/core/errors";

const HONEYPOT_FIELD = "companyWebsite";
const MINIMUM_HUMAN_FILL_MS = 1200;

export function assertSameOriginRequest(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin) {
    if (request.method === "GET" || request.method === "HEAD") return;

    throw new AppError(
      "FORBIDDEN",
      "This request could not be verified. Reload the page and try again.",
    );
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "This request could not be verified.");
  }

  if (!host || originHost !== host) {
    throw new AppError("FORBIDDEN", "This request could not be verified.");
  }
}

export interface BotSignals {
  honeypotValue?: unknown;
  clientRenderedAt?: unknown;
}

export type BotVerdict =
  | { looksAutomated: false }
  | { looksAutomated: true; signal: "HONEYPOT_FILLED" | "SUBMITTED_TOO_FAST" };

export function inspectBotSignals({
  honeypotValue,
  clientRenderedAt,
}: BotSignals): BotVerdict {
  if (typeof honeypotValue === "string" && honeypotValue.trim().length > 0) {
    return { looksAutomated: true, signal: "HONEYPOT_FILLED" };
  }

  if (typeof clientRenderedAt === "number") {
    const elapsed = Date.now() - clientRenderedAt;
    if (elapsed >= 0 && elapsed < MINIMUM_HUMAN_FILL_MS) {
      return { looksAutomated: true, signal: "SUBMITTED_TOO_FAST" };
    }
  }

  return { looksAutomated: false };
}

export const BOT_HONEYPOT_FIELD_NAME = HONEYPOT_FIELD;
