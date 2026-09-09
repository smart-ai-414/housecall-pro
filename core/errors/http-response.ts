import { NextResponse } from "next/server";
import { z } from "zod";

import { AppError, type ErrorCode } from "./app-error";
import { validationError } from "./action-result";

export function errorResponse(error: unknown, operation: string): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.toShape() },
      { status: error.status },
    );
  }

  if (error instanceof z.ZodError) {
    const result = validationError(error);
    return NextResponse.json(
      { error: result.ok ? null : result.error },
      { status: 400 },
    );
  }

  console.error(`[route:${operation}]`, error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR" satisfies ErrorCode,
        message: "Something went wrong on our end. Please try again.",
      },
    },
    { status: 500 },
  );
}
