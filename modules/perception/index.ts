import { createGeminiProvider } from "@/modules/perception/gemini-provider";
import { registerProvider } from "@/modules/perception/provider-registry";

let registered = false;

export function registerBuiltInProviders(): void {
  if (registered) return;
  registerProvider("gemini", createGeminiProvider);
  registered = true;
}

registerBuiltInProviders();

export {
  assessPhotoQuality,
  classify,
  estimateDimensions,
} from "@/modules/perception/perception-service";
export * from "@/modules/perception/schemas";
export type {
  PerceptionInput,
  PerceptionOutcome,
  PerceptionPhoto,
  PerceptionProvider,
} from "@/modules/perception/types";
