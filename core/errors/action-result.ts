import { z } from "zod";

import { AppError, type AppErrorShape, type ErrorCode } from "./app-error";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: AppErrorShape };

export function actionOk(): ActionResult<void>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}

export function actionError(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return {
    ok: false,
    error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
  };
}

export function validationError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return actionError(
    "VALIDATION_FAILED",
    "Please correct the highlighted fields.",
    fieldErrors,
  );
}

export async function withActionErrorHandling<T>(
  operation: string,
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.toShape() };
    }
    if (error instanceof z.ZodError) {
      return validationError(error);
    }

    console.error(`[action:${operation}]`, error);
    return actionError(
      "INTERNAL_ERROR",
      "Something went wrong on our end. Please try again.",
    );
  }
}
