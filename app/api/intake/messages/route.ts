import { NextResponse } from "next/server";

import { errorResponse } from "@/core/errors/http-response";
import { assertSameOriginRequest } from "@/core/security/request-guard";
import { customerMessageSchema } from "@/modules/intake/schemas";
import { recordCustomerMessage } from "@/modules/intake/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);

    const payload = customerMessageSchema.parse(await request.json());
    const session = await recordCustomerMessage(payload);

    return NextResponse.json(session);
  } catch (error) {
    return errorResponse(error, "intake/messages");
  }
}
