import { NextResponse } from "next/server";

import { errorResponse } from "@/core/errors/http-response";
import { assertSameOriginRequest } from "@/core/security/request-guard";
import { dimensionConfirmationSchema } from "@/modules/intake/schemas";
import { recordDimensionConfirmation } from "@/modules/intake/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);

    const payload = dimensionConfirmationSchema.parse(await request.json());
    const session = await recordDimensionConfirmation(payload);

    return NextResponse.json(session);
  } catch (error) {
    return errorResponse(error, "intake/confirm-dimensions");
  }
}
