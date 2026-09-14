import { config as loadEnv } from "dotenv";
import sharp from "sharp";

loadEnv({ path: ".env", quiet: true });

import { isAnthropicConfigured, isGeminiConfigured } from "../core/config/env";
import "../modules/perception/index";
import { classify } from "../modules/perception/perception-service";
import {
  KNOWN_PROVIDER_NAMES,
  resolveProvider,
  resolveProviderName,
  type ProviderName,
} from "../modules/perception/provider-registry";
import type { PerceptionPhoto } from "../modules/perception/types";

const PROBE_TIMEOUT_MS = 45_000;

async function buildProbePhoto(): Promise<PerceptionPhoto> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
      <rect width="900" height="1200" fill="#d8dee6"/>
      <rect x="120" y="220" width="660" height="820" fill="#9fb3c8"/>
      <rect x="150" y="250" width="600" height="760" fill="#e8f1f8"/>
      <line x1="150" y1="250" x2="750" y2="1010" stroke="#33414f" stroke-width="6"/>
      <rect x="0" y="1130" width="900" height="70" fill="#b6a48f"/>
    </svg>`,
  );

  return {
    label: "Synthetic probe image",
    contentType: "image/jpeg",
    data: await sharp(svg).jpeg({ quality: 80 }).toBuffer(),
  };
}

function configuredFor(provider: ProviderName): boolean {
  return provider === "gemini" ? isGeminiConfigured() : isAnthropicConfigured();
}

async function probe(provider: ProviderName, photo: PerceptionPhoto) {
  console.log(`\n  ${provider}`);

  if (!configuredFor(provider)) {
    console.log("    SKIPPED — no API key configured for this provider");
    return;
  }

  const startedAt = Date.now();

  const outcome = await classify(
    {
      photos: [photo],
      customerDescription:
        "A reachability probe. This is a synthetic drawing of a cracked window, not a real job.",
    },
    {
      provider: resolveProvider("classify", { PERCEPTION_PROVIDER: provider }),
    },
  );

  const elapsed = Date.now() - startedAt;

  if (outcome.status === "OK") {
    console.log(`    REACHABLE — ${elapsed}ms, model ${outcome.model}`);
    console.log(
      `    Answered: ${outcome.value.assetType} / ${outcome.value.issueType} ` +
        `at ${outcome.value.confidence.toFixed(2)} confidence`,
    );
  } else {
    console.log(
      `    UNREACHABLE — ${elapsed}ms after ${outcome.attempts} attempts`,
    );
    console.log(`    ${outcome.reason.slice(0, 400)}`);
  }
}

async function main() {
  console.log("\nPERCEPTION PROVIDER PROBE");
  console.log(
    "  One real, paid call per configured provider. Run this from the machine the",
    "\n  app will actually run on — a datacenter IP can be blocked where a laptop is not.",
  );

  console.log("\n  ROUTING AS CONFIGURED");
  for (const perceptionFunction of [
    "classify",
    "estimateDimensions",
    "assessPhotoQuality",
  ] as const) {
    console.log(
      `    ${perceptionFunction.padEnd(20)} ${resolveProviderName(perceptionFunction)}`,
    );
  }

  const photo = await buildProbePhoto();

  for (const provider of KNOWN_PROVIDER_NAMES) {
    await probe(provider, photo);
  }

  console.log("");
}

const timeout = setTimeout(() => {
  console.error(`\nProbe exceeded ${PROBE_TIMEOUT_MS}ms overall. Giving up.`);
  process.exit(1);
}, PROBE_TIMEOUT_MS * KNOWN_PROVIDER_NAMES.length);

main()
  .then(() => clearTimeout(timeout))
  .catch((error) => {
    clearTimeout(timeout);
    console.error(error);
    process.exit(1);
  });
