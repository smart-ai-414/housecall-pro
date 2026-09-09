import { NextResponse } from "next/server";

import { AppError } from "@/core/errors";
import { errorResponse } from "@/core/errors/http-response";
import { assertSameOriginRequest } from "@/core/security/request-guard";
import { photoUploadUrlSchema } from "@/modules/intake/schemas";
import { authenticateSession } from "@/modules/intake/session-service";
import {
  assertUploadSizeWithinLimit,
  ImageRejectedError,
} from "@/modules/photos/image-processing";
import { requestPhotoUpload } from "@/modules/photos/photo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);

    const payload = photoUploadUrlSchema.parse(await request.json());

    await authenticateSession({
      sessionId: payload.sessionId,
      resumeToken: payload.resumeToken,
    });

    try {
      assertUploadSizeWithinLimit(payload.byteSize);
    } catch (error) {
      if (error instanceof ImageRejectedError) {
        throw new AppError("VALIDATION_FAILED", error.message);
      }
      throw error;
    }

    const upload = await requestPhotoUpload({
      sessionId: payload.sessionId,
      photoType: payload.photoType,
      contentType: payload.contentType,
    });

    return NextResponse.json(upload, { status: 201 });
  } catch (error) {
    return errorResponse(error, "intake/photo-upload-url");
  }
}
