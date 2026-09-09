import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { secretsEnv } from "@/core/config/env";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

function getKey(): Buffer {
  return Buffer.from(secretsEnv().ENCRYPTION_KEY, "base64");
}

export function encryptSecret(plaintext: string): string {
  if (plaintext.length === 0) {
    throw new Error("Refusing to encrypt an empty secret");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(encrypted: string): string {
  const parts = encrypted.split(".");
  if (parts.length !== 4) {
    throw new DecryptionError("Malformed ciphertext: expected 4 parts");
  }

  const [version, ivPart, authTagPart, ciphertextPart] = parts;
  if (version !== VERSION) {
    throw new DecryptionError(`Unsupported ciphertext version: ${version}`);
  }

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  if (iv.length !== IV_LENGTH) {
    throw new DecryptionError("Malformed ciphertext: bad IV length");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new DecryptionError("Malformed ciphertext: bad auth tag length");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new DecryptionError(
      "Failed to decrypt: wrong ENCRYPTION_KEY or the ciphertext was tampered with",
    );
  }
}

const VISIBLE_SUFFIX_LENGTH = 4;
const MASK = "••••";

export function maskSecret(plaintext: string): string {
  if (plaintext.length <= VISIBLE_SUFFIX_LENGTH) return MASK;
  return `${MASK}${plaintext.slice(-VISIBLE_SUFFIX_LENGTH)}`;
}

export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  const lengthsMatch = bufferA.length === bufferB.length;
  if (!lengthsMatch) return false;

  return timingSafeEqual(bufferA, bufferB);
}
