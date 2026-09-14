import { resolveProvider } from "@/modules/perception/provider-registry";
import type {
  ClassificationResult,
  DimensionResult,
  PhotoQualityResult,
} from "@/modules/perception/schemas";
import type {
  DimensionInput,
  PerceptionFunction,
  PerceptionInput,
  PerceptionOutcome,
  PerceptionProvider,
} from "@/modules/perception/types";

export const PERCEPTION_TIMEOUT_MS = 30_000;
export const PERCEPTION_MAX_ATTEMPTS = 2;

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Perception call exceeded ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runWithFailThrough<T>({
  perceptionFunction,
  call,
  provider,
  timeoutMs = PERCEPTION_TIMEOUT_MS,
  maxAttempts = PERCEPTION_MAX_ATTEMPTS,
}: {
  perceptionFunction: PerceptionFunction;
  call: (provider: PerceptionProvider) => Promise<T>;
  provider: PerceptionProvider;
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<PerceptionOutcome<T>> {
  let lastReason = "No attempt was made";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await withTimeout(call(provider), timeoutMs);
      return {
        status: "OK",
        value,
        provider: provider.name,
        attempts: attempt,
      };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);

      console.warn(
        `[perception] ${perceptionFunction} attempt ${attempt}/${maxAttempts} failed on ${provider.name}: ${lastReason}`,
      );
    }
  }

  return {
    status: "FAILED",
    reason: lastReason,
    provider: provider.name,
    attempts: maxAttempts,
  };
}

async function guarded<T>(
  perceptionFunction: PerceptionFunction,
  call: (provider: PerceptionProvider) => Promise<T>,
  overrides?: { provider?: PerceptionProvider; timeoutMs?: number },
): Promise<PerceptionOutcome<T>> {
  let provider: PerceptionProvider;

  try {
    provider = overrides?.provider ?? resolveProvider(perceptionFunction);
  } catch (error) {
    return {
      status: "FAILED",
      reason: error instanceof Error ? error.message : String(error),
      provider: "none",
      attempts: 0,
    };
  }

  return runWithFailThrough({
    perceptionFunction,
    call,
    provider,
    timeoutMs: overrides?.timeoutMs,
  });
}

export function classify(
  input: PerceptionInput,
  overrides?: { provider?: PerceptionProvider; timeoutMs?: number },
): Promise<PerceptionOutcome<ClassificationResult>> {
  return guarded("classify", (provider) => provider.classify(input), overrides);
}

export function estimateDimensions(
  input: DimensionInput,
  overrides?: { provider?: PerceptionProvider; timeoutMs?: number },
): Promise<PerceptionOutcome<DimensionResult>> {
  return guarded(
    "estimateDimensions",
    (provider) => provider.estimateDimensions(input),
    overrides,
  );
}

export function assessPhotoQuality(
  input: PerceptionInput,
  overrides?: { provider?: PerceptionProvider; timeoutMs?: number },
): Promise<PerceptionOutcome<PhotoQualityResult>> {
  return guarded(
    "assessPhotoQuality",
    (provider) => provider.assessPhotoQuality(input),
    overrides,
  );
}
