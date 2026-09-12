import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { secretsEnv } from "@/core/config/env";
import { RESUME_TOKEN_TTL_MS } from "@/core/security/resume-token-policy";

const NONCE_BYTES = 16;
const TOKEN_PART_COUNT = 4;

export interface ResumeTokenPayload {
  sessionId: string;
  issuedAt: Date;
  expiresAt: Date;
}

function sign(sessionId: string, nonce: string, issuedAt: string): string {
  return createHmac("sha256", secretsEnv().RESUME_TOKEN_SECRET)
    .update(`${sessionId}.${nonce}.${issuedAt}`)
    .digest("base64url");
}

export function createResumeToken(sessionId: string): string {
  const nonce = randomBytes(NONCE_BYTES).toString("base64url");
  const issuedAt = Date.now().toString(36);
  return `${sessionId}.${nonce}.${issuedAt}.${sign(sessionId, nonce, issuedAt)}`;
}

export function verifyResumeToken(token: string): ResumeTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== TOKEN_PART_COUNT) return null;

  const [sessionId, nonce, issuedAt, providedSignature] = parts;
  if (!sessionId || !nonce || !issuedAt || !providedSignature) return null;

  const expectedSignature = Buffer.from(
    sign(sessionId, nonce, issuedAt),
    "utf8",
  );
  const providedSignatureBytes = Buffer.from(providedSignature, "utf8");

  if (expectedSignature.length !== providedSignatureBytes.length) return null;
  if (!timingSafeEqual(expectedSignature, providedSignatureBytes)) return null;

  const issuedAtMs = Number.parseInt(issuedAt, 36);
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return null;

  const expiresAtMs = issuedAtMs + RESUME_TOKEN_TTL_MS;
  if (Date.now() > expiresAtMs) return null;

  return {
    sessionId,
    issuedAt: new Date(issuedAtMs),
    expiresAt: new Date(expiresAtMs),
  };
}
