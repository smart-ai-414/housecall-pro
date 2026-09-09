import { rateLimitEnv } from "@/core/config/env";
import { prisma } from "@/core/db/prisma";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_IP = "unknown";

export type RateLimitDecision =
  | { allowed: true; remainingToday: number }
  | { allowed: false; reason: "BLOCKED"; retryAfterSeconds: number }
  | { allowed: false; reason: "DAILY_LIMIT"; retryAfterSeconds: number }
  | { allowed: false; reason: "TOO_FAST"; retryAfterSeconds: number };

export function readClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return headers.get("x-real-ip")?.trim() || UNKNOWN_IP;
}

function secondsUntil(target: Date): number {
  return Math.max(1, Math.ceil((target.getTime() - Date.now()) / 1000));
}

export async function consumeSessionCreationBudget(
  ipAddress: string,
): Promise<RateLimitDecision> {
  const {
    RATE_LIMIT_SESSIONS_PER_DAY,
    RATE_LIMIT_MIN_SECONDS_BETWEEN_SESSIONS,
  } = rateLimitEnv();

  const now = new Date();

  const existing = await prisma.rateLimitLog.findUnique({
    where: { ipAddress },
  });

  if (!existing) {
    await prisma.rateLimitLog.create({
      data: {
        ipAddress,
        sessionCountToday: 1,
        countWindowStartedAt: now,
        lastSessionAt: now,
      },
    });

    return { allowed: true, remainingToday: RATE_LIMIT_SESSIONS_PER_DAY - 1 };
  }

  if (existing.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      reason: "BLOCKED",
      retryAfterSeconds: secondsUntil(existing.blockedUntil),
    };
  }

  const windowExpired =
    now.getTime() - existing.countWindowStartedAt.getTime() >= WINDOW_MS;

  if (
    !windowExpired &&
    existing.lastSessionAt &&
    now.getTime() - existing.lastSessionAt.getTime() <
      RATE_LIMIT_MIN_SECONDS_BETWEEN_SESSIONS * 1000
  ) {
    const retryAt = new Date(
      existing.lastSessionAt.getTime() +
        RATE_LIMIT_MIN_SECONDS_BETWEEN_SESSIONS * 1000,
    );

    return {
      allowed: false,
      reason: "TOO_FAST",
      retryAfterSeconds: secondsUntil(retryAt),
    };
  }

  const countSoFar = windowExpired ? 0 : existing.sessionCountToday;

  if (countSoFar >= RATE_LIMIT_SESSIONS_PER_DAY) {
    const blockedUntil = new Date(now.getTime() + BLOCK_DURATION_MS);

    await prisma.rateLimitLog.update({
      where: { ipAddress },
      data: { blockedUntil },
    });

    return {
      allowed: false,
      reason: "DAILY_LIMIT",
      retryAfterSeconds: secondsUntil(blockedUntil),
    };
  }

  await prisma.rateLimitLog.update({
    where: { ipAddress },
    data: {
      sessionCountToday: countSoFar + 1,
      countWindowStartedAt: windowExpired ? now : existing.countWindowStartedAt,
      lastSessionAt: now,
      blockedUntil: null,
    },
  });

  return {
    allowed: true,
    remainingToday: RATE_LIMIT_SESSIONS_PER_DAY - (countSoFar + 1),
  };
}

export function describeRateLimit(decision: RateLimitDecision): string {
  if (decision.allowed) return "Allowed";

  switch (decision.reason) {
    case "TOO_FAST":
      return "You just started a request. Give it a moment before starting another.";
    case "DAILY_LIMIT":
    case "BLOCKED":
      return "You have started several estimate requests today. Please call us and we will help directly.";
  }
}
