import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { storageEnv } from "@/core/config/env";
import type { PhotoType } from "@/generated/prisma/enums";
import {
  ACCEPTED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  PROCESSED_CONTENT_TYPE,
} from "@/modules/photos/image-processing";

export const UPLOAD_URL_TTL_SECONDS = 300;
export const READ_URL_TTL_SECONDS = 900;

const ORIGINAL_PREFIX = "originals";
const PROCESSED_PREFIX = "processed";

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;

  const env = storageEnv();

  cachedClient = new S3Client({
    region: env.STORAGE_REGION,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    },
    ...(env.STORAGE_ENDPOINT
      ? { endpoint: env.STORAGE_ENDPOINT, forcePathStyle: true }
      : {}),
  });

  return cachedClient;
}

export interface SignedUpload {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  maxBytes: number;
  requiredContentType: string;
}

export function isAcceptedUploadContentType(value: string): boolean {
  return (ACCEPTED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(value);
}

export function buildOriginalKey(
  sessionId: string,
  photoType: PhotoType,
): string {
  return `${ORIGINAL_PREFIX}/${sessionId}/${photoType.toLowerCase()}-${randomUUID()}`;
}

export function buildProcessedKey(
  sessionId: string,
  photoType: PhotoType,
): string {
  return `${PROCESSED_PREFIX}/${sessionId}/${photoType.toLowerCase()}-${randomUUID()}.jpg`;
}

export async function createSignedUploadUrl({
  sessionId,
  photoType,
  contentType,
}: {
  sessionId: string;
  photoType: PhotoType;
  contentType: string;
}): Promise<SignedUpload> {
  const env = storageEnv();
  const storageKey = buildOriginalKey(sessionId, photoType);

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: storageKey,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return {
    uploadUrl,
    storageKey,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    maxBytes: MAX_UPLOAD_BYTES,
    requiredContentType: contentType,
  };
}

export async function downloadObject(storageKey: string): Promise<Buffer> {
  const env = storageEnv();

  const response = await getClient().send(
    new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: storageKey }),
  );

  if (!response.Body) {
    throw new Error(`Storage object ${storageKey} had no body`);
  }

  return Buffer.from(await response.Body.transformToByteArray());
}

export async function uploadProcessedPhoto({
  storageKey,
  body,
}: {
  storageKey: string;
  body: Buffer;
}): Promise<void> {
  const env = storageEnv();

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: storageKey,
      Body: body,
      ContentType: PROCESSED_CONTENT_TYPE,
    }),
  );
}

export async function deleteObject(storageKey: string): Promise<void> {
  const env = storageEnv();

  await getClient().send(
    new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: storageKey }),
  );
}

export function buildPublicUrl(storageKey: string): string | null {
  const base = storageEnv().STORAGE_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${storageKey}`;
}

export async function createSignedReadUrl(
  storageKey: string,
  expiresInSeconds = READ_URL_TTL_SECONDS,
): Promise<string> {
  const env = storageEnv();

  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: storageKey }),
    { expiresIn: expiresInSeconds },
  );
}

export async function resolvePhotoUrl(storageKey: string): Promise<string> {
  return buildPublicUrl(storageKey) ?? createSignedReadUrl(storageKey);
}
