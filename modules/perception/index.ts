import { createAnthropicProvider } from "@/modules/perception/anthropic-provider";
import { createGeminiProvider } from "@/modules/perception/gemini-provider";
import { registerProvider } from "@/modules/perception/provider-registry";

let registered = false;

export function registerBuiltInProviders(): void {
  if (registered) return;
  registerProvider("gemini", createGeminiProvider);
  registerProvider("anthropic", createAnthropicProvider);
  registered = true;
}

registerBuiltInProviders();

export {
  observe,
  estimateDimensions,
} from "@/modules/perception/perception-service";
export * from "@/modules/perception/schemas";
export type {
  PerceptionInput,
  PerceptionObservation,
  PerceptionOutcome,
  PerceptionPhoto,
  PerceptionProvider,
} from "@/modules/perception/types";
