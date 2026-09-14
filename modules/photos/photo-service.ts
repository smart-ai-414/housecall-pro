import { isStorageConfigured } from "@/core/config/env";
import { prisma } from "@/core/db/prisma";
import { AppError } from "@/core/errors";
import type { PhotoType } from "@/generated/prisma/enums";
import {
  ImageRejectedError,
  processPhotoForAnalysis,
} from "@/modules/photos/image-processing";
import {
  outstandingPhotoTypesFor,
  REQUIRED_PHOTO_TYPES,
} from "@/modules/photos/photo-requirements";
export * from "@/modules/photos/photo-requirements";
import {
  buildProcessedKey,
  createSignedUploadUrl,
  deleteObject,
  downloadObject,
  isAcceptedUploadContentType,
  resolvePhotoUrl,
  uploadProcessedPhoto,
  type SignedUpload,
} from "@/modules/photos/storage";

export const PHOTO_UPLOAD_UNAVAILABLE_MESSAGE =
  "Photo upload is not switched on yet. Carry on without photos and our team will be in touch, or call us and we will take the details over the phone.";

export function isPhotoUploadAvailable(): boolean {
  return isStorageConfigured();
}

export async function requestPhotoUpload({
  sessionId,
  photoType,
  contentType,
}: {
  sessionId: string;
  photoType: PhotoType;
  contentType: string;
}): Promise<SignedUpload> {
  if (!isPhotoUploadAvailable()) {
    throw new AppError("FEATURE_UNAVAILABLE", PHOTO_UPLOAD_UNAVAILABLE_MESSAGE);
  }

  if (!isAcceptedUploadContentType(contentType)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "That file type is not supported. Send a photo from your camera roll.",
    );
  }

  return createSignedUploadUrl({ sessionId, photoType, contentType });
}

export interface StoredPhoto {
  id: string;
  photoType: PhotoType;
  storageKey: string;
  storageUrl: string;
  width: number;
  height: number;
}

export async function ingestUploadedPhoto({
  sessionId,
  photoType,
  originalStorageKey,
}: {
  sessionId: string;
  photoType: PhotoType;
  originalStorageKey: string;
}): Promise<StoredPhoto> {
  const original = await downloadObject(originalStorageKey);

  let processed;
  try {
    processed = await processPhotoForAnalysis(original);
  } catch (error) {
    if (error instanceof ImageRejectedError) {
      await deleteObject(originalStorageKey).catch(() => undefined);
      throw new AppError("VALIDATION_FAILED", error.message);
    }
    throw error;
  }

  const processedKey = buildProcessedKey(sessionId, photoType);
  await uploadProcessedPhoto({
    storageKey: processedKey,
    body: processed.buffer,
  });

  const storageUrl = await resolvePhotoUrl(processedKey);

  const record = await prisma.sessionPhoto.upsert({
    where: { sessionId_photoType: { sessionId, photoType } },
    create: {
      sessionId,
      photoType,
      storageKey: processedKey,
      storageUrl,
      contentType: processed.contentType,
      byteSize: processed.byteSize,
      originalWidth: processed.originalWidth,
      originalHeight: processed.originalHeight,
      isHeicConverted: processed.isHeicConverted,
      exifOrientationApplied: processed.exifOrientationApplied,
      metadataStripped: processed.metadataStripped,
    },
    update: {
      storageKey: processedKey,
      storageUrl,
      contentType: processed.contentType,
      byteSize: processed.byteSize,
      originalWidth: processed.originalWidth,
      originalHeight: processed.originalHeight,
      isHeicConverted: processed.isHeicConverted,
      exifOrientationApplied: processed.exifOrientationApplied,
      metadataStripped: processed.metadataStripped,
    },
    select: { id: true, photoType: true, storageKey: true, storageUrl: true },
  });

  await deleteObject(originalStorageKey).catch(() => undefined);

  return {
    id: record.id,
    photoType: record.photoType,
    storageKey: record.storageKey,
    storageUrl: record.storageUrl,
    width: processed.width,
    height: processed.height,
  };
}

export async function listOutstandingPhotoTypes(
  sessionId: string,
): Promise<PhotoType[]> {
  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      requestedPhotoTypes: true,
      declinedPhotoTypes: true,
      photos: { select: { photoType: true } },
    },
  });

  if (!session) return [...REQUIRED_PHOTO_TYPES];

  return outstandingPhotoTypesFor({
    received: session.photos.map((photo) => photo.photoType),
    requested: session.requestedPhotoTypes,
    declined: session.declinedPhotoTypes,
  });
}
