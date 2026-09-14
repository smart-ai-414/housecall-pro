import { NextResponse } from "next/server";

import { errorResponse } from "@/core/errors/http-response";
import { assertSameOriginRequest } from "@/core/security/request-guard";
import { declinePhotoSchema } from "@/modules/intake/schemas";
import { declineRequestedPhoto } from "@/modules/intake/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);

    const payload = declinePhotoSchema.parse(await request.json());
    const session = await declineRequestedPhoto(payload);

    return NextResponse.json(session);
  } catch (error) {
    return errorResponse(error, "intake/decline-photo");
  }
}
