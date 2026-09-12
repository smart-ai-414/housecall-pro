import { publicAppUrl } from "@/core/config/env";
import { createPhotoAccessToken } from "@/core/security/photo-access-token";

export const PHOTO_LINK_PATH_PREFIX = "/api/photos";

export function buildDurablePhotoUrl(photoId: string): string | null {
  const origin = publicAppUrl();
  if (!origin) return null;

  const token = createPhotoAccessToken(photoId);
  return `${origin}${PHOTO_LINK_PATH_PREFIX}/${encodeURIComponent(token)}`;
}
