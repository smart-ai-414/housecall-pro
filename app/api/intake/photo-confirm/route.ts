import { NextResponse } from "next/server";

import { AppError } from "@/core/errors";
import { errorResponse } from "@/core/errors/http-response";
import { assertSameOriginRequest } from "@/core/security/request-guard";
import { photoConfirmSchema } from "@/modules/intake/schemas";
import {
  authenticateSession,
  recordPhotoReceived,
} from "@/modules/intake/session-service";
import { ingestUploadedPhoto } from "@/modules/photos/photo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);

    const payload = photoConfirmSchema.parse(await request.json());

    await authenticateSession({
      sessionId: payload.sessionId,
      resumeToken: payload.resumeToken,
    });

    if (!payload.storageKey.includes(payload.sessionId)) {
      throw new AppError(
        "FORBIDDEN",
        "That upload does not belong to this session.",
      );
    }

    await ingestUploadedPhoto({
      sessionId: payload.sessionId,
      photoType: payload.photoType,
      originalStorageKey: payload.storageKey,
    });

    const session = await recordPhotoReceived({
      sessionId: payload.sessionId,
      resumeToken: payload.resumeToken,
      photoType: payload.photoType,
    });

    return NextResponse.json(session);
  } catch (error) {
    return errorResponse(error, "intake/photo-confirm");
  }
}
