import { NextResponse } from "next/server";

import { AppError } from "@/core/errors";
import { errorResponse } from "@/core/errors/http-response";
import { readClientIp } from "@/core/security/rate-limit";
import {
  assertSameOriginRequest,
  inspectBotSignals,
} from "@/core/security/request-guard";
import { startSessionSchema } from "@/modules/intake/schemas";
import { startIntakeSession } from "@/modules/intake/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);

    const payload = startSessionSchema.parse(await request.json());

    const verdict = inspectBotSignals({
      honeypotValue: payload.companyWebsite,
      clientRenderedAt: payload.clientRenderedAt,
    });

    if (verdict.looksAutomated) {
      throw new AppError(
        "FORBIDDEN",
        "We could not verify that request came from a browser. Please call us instead.",
      );
    }

    const session = await startIntakeSession({
      ipAddress: readClientIp(request.headers),
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return errorResponse(error, "intake/sessions");
  }
}
