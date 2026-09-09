import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { secretsEnv } from "@/core/config/env";

const NONCE_BYTES = 16;
const TOKEN_PART_COUNT = 3;

export interface ResumeTokenPayload {
  sessionId: string;
}

function sign(sessionId: string, nonce: string): string {
  return createHmac("sha256", secretsEnv().RESUME_TOKEN_SECRET)
    .update(`${sessionId}.${nonce}`)
    .digest("base64url");
}

export function createResumeToken(sessionId: string): string {
  const nonce = randomBytes(NONCE_BYTES).toString("base64url");
  return `${sessionId}.${nonce}.${sign(sessionId, nonce)}`;
}

export function verifyResumeToken(token: string): ResumeTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== TOKEN_PART_COUNT) return null;

  const [sessionId, nonce, providedSignature] = parts;
  if (!sessionId || !nonce || !providedSignature) return null;

  const expectedSignature = Buffer.from(sign(sessionId, nonce), "utf8");
  const providedSignatureBytes = Buffer.from(providedSignature, "utf8");

  if (expectedSignature.length !== providedSignatureBytes.length) return null;
  if (!timingSafeEqual(expectedSignature, providedSignatureBytes)) return null;

  return { sessionId };
}

function withoutTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function buildResumeUrl(token: string, origin: string): string {
  const base = withoutTrailingSlash(origin);
  return `${base}/estimate/resume/${encodeURIComponent(token)}`;
}
