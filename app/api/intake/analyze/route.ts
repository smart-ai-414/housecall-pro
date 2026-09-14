import { NextResponse } from "next/server";

import { errorResponse } from "@/core/errors/http-response";
import { assertSameOriginRequest } from "@/core/security/request-guard";
import { sessionCredentialsSchema } from "@/modules/intake/schemas";
import { analyzeSessionPhotos } from "@/modules/intake/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);

    const payload = sessionCredentialsSchema.parse(await request.json());
    const session = await analyzeSessionPhotos(payload);

    return NextResponse.json(session);
  } catch (error) {
    return errorResponse(error, "intake/analyze");
  }
}
