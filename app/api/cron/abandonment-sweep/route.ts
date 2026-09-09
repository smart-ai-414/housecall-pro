import { NextResponse } from "next/server";

import { errorResponse } from "@/core/errors/http-response";
import { AppError } from "@/core/errors";
import { safeEqual } from "@/core/security/encryption";
import { sweepAbandonedSessions } from "@/modules/intake/abandonment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function assertAuthorizedCronRequest(request: Request): void {
  const configured = process.env.CRON_SECRET;

  if (!configured) {
    throw new AppError(
      "CONFIGURATION_ERROR",
      "CRON_SECRET is not set, so the sweep refuses to run. An unauthenticated sweep can write to the live Housecall Pro account.",
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${configured}`;

  if (!safeEqual(header, expected)) {
    throw new AppError("UNAUTHENTICATED", "Not authorized.");
  }
}

async function runSweep(request: Request) {
  try {
    assertAuthorizedCronRequest(request);
    const result = await sweepAbandonedSessions();
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "cron/abandonment-sweep");
  }
}

export async function GET(request: Request) {
  return runSweep(request);
}

export async function POST(request: Request) {
  return runSweep(request);
}
