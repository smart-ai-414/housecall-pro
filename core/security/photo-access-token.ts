import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { secretsEnv } from "@/core/config/env";

const NONCE_BYTES = 16;
const TOKEN_PART_COUNT = 4;
const SIGNING_DOMAIN = "photo-access";

export const PHOTO_ACCESS_TTL_DAYS = 90;
const PHOTO_ACCESS_TTL_MS = PHOTO_ACCESS_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface PhotoAccessPayload {
  photoId: string;
  expiresAt: Date;
}

function sign(photoId: string, nonce: string, issuedAt: string): string {
  return createHmac("sha256", secretsEnv().RESUME_TOKEN_SECRET)
    .update(`${SIGNING_DOMAIN}.${photoId}.${nonce}.${issuedAt}`)
    .digest("base64url");
}

export function createPhotoAccessToken(photoId: string): string {
  const nonce = randomBytes(NONCE_BYTES).toString("base64url");
  const issuedAt = Date.now().toString(36);
  return `${photoId}.${nonce}.${issuedAt}.${sign(photoId, nonce, issuedAt)}`;
}

export function verifyPhotoAccessToken(
  token: string,
): PhotoAccessPayload | null {
  const parts = token.split(".");
  if (parts.length !== TOKEN_PART_COUNT) return null;

  const [photoId, nonce, issuedAt, providedSignature] = parts;
  if (!photoId || !nonce || !issuedAt || !providedSignature) return null;

  const expectedSignature = Buffer.from(sign(photoId, nonce, issuedAt), "utf8");
  const providedSignatureBytes = Buffer.from(providedSignature, "utf8");

  if (expectedSignature.length !== providedSignatureBytes.length) return null;
  if (!timingSafeEqual(expectedSignature, providedSignatureBytes)) return null;

  const issuedAtMs = Number.parseInt(issuedAt, 36);
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return null;

  const expiresAtMs = issuedAtMs + PHOTO_ACCESS_TTL_MS;
  if (Date.now() > expiresAtMs) return null;

  return { photoId, expiresAt: new Date(expiresAtMs) };
}
