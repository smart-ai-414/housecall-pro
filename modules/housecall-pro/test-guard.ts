import { TEST_RECORD_PREFIX } from "@/core/config/branding";
import { AppError } from "@/core/errors";

export function isLiveWriteEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function shouldMarkAsTestRecord(): boolean {
  return !isLiveWriteEnvironment();
}

export function applyTestPrefix(value: string): string {
  if (!shouldMarkAsTestRecord()) return value;
  if (value.startsWith(TEST_RECORD_PREFIX)) return value;
  return `${TEST_RECORD_PREFIX} ${value}`;
}

export function carriesTestPrefix(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(TEST_RECORD_PREFIX);
}

export function assertSafeToWriteFromThisEnvironment(
  targetDescription: string,
  existingName: string | null | undefined,
): void {
  if (isLiveWriteEnvironment()) return;
  if (existingName === null || existingName === undefined) return;
  if (carriesTestPrefix(existingName)) return;

  throw new AppError(
    "FORBIDDEN",
    `Refusing to modify ${targetDescription} from a non-production environment: "${existingName}" is not a ${TEST_RECORD_PREFIX} record. Housecall Pro has no sandbox, so this would touch live customer data.`,
  );
}

export function describeWriteEnvironment(): string {
  return isLiveWriteEnvironment()
    ? "production, writing live records"
    : `non-production, writing ${TEST_RECORD_PREFIX}-prefixed records into the live account`;
}
