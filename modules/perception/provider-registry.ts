import {
  PerceptionUnavailableError,
  type PerceptionFunction,
  type PerceptionProvider,
} from "@/modules/perception/types";

export const KNOWN_PROVIDER_NAMES = ["gemini", "anthropic"] as const;

export type ProviderName = (typeof KNOWN_PROVIDER_NAMES)[number];

export const DEFAULT_PROVIDER: ProviderName = "gemini";

const FUNCTION_ENV_KEYS: Record<PerceptionFunction, string> = {
  classify: "PERCEPTION_PROVIDER_CLASSIFY",
  estimateDimensions: "PERCEPTION_PROVIDER_DIMENSIONS",
  assessPhotoQuality: "PERCEPTION_PROVIDER_PHOTO_QUALITY",
};

const FALLBACK_ENV_KEY = "PERCEPTION_PROVIDER";

function isKnownProvider(value: string): value is ProviderName {
  return (KNOWN_PROVIDER_NAMES as readonly string[]).includes(value);
}

export function resolveProviderName(
  perceptionFunction: PerceptionFunction,
  env: Readonly<Record<string, string | undefined>> = process.env,
): ProviderName {
  const candidates = [
    env[FUNCTION_ENV_KEYS[perceptionFunction]],
    env[FALLBACK_ENV_KEY],
  ];

  for (const candidate of candidates) {
    const normalized = (candidate ?? "").trim().toLowerCase();
    if (normalized === "") continue;
    if (isKnownProvider(normalized)) return normalized;

    throw new PerceptionUnavailableError(
      `Unknown perception provider "${normalized}". Known providers: ${KNOWN_PROVIDER_NAMES.join(", ")}.`,
    );
  }

  return DEFAULT_PROVIDER;
}

export type ProviderFactory = () => PerceptionProvider;

const factories = new Map<ProviderName, ProviderFactory>();

export function registerProvider(
  name: ProviderName,
  factory: ProviderFactory,
): void {
  factories.set(name, factory);
}

export function resolveProvider(
  perceptionFunction: PerceptionFunction,
  env: Readonly<Record<string, string | undefined>> = process.env,
): PerceptionProvider {
  const name = resolveProviderName(perceptionFunction, env);
  const factory = factories.get(name);

  if (!factory) {
    throw new PerceptionUnavailableError(
      `Perception provider "${name}" is selected but not registered.`,
    );
  }

  return factory();
}

export function registeredProviderNames(): ProviderName[] {
  return [...factories.keys()];
}

export function clearRegisteredProviders(): void {
  factories.clear();
}
