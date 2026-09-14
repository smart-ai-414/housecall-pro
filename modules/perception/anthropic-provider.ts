import Anthropic from "@anthropic-ai/sdk";

import { anthropicEnv } from "@/core/config/env";
import {
  classificationPrompt,
  dimensionPrompt,
  photoQualityPrompt,
} from "@/modules/perception/prompts";
import {
  classificationResultSchema,
  dimensionResultSchema,
  photoQualityResultSchema,
  type ClassificationResult,
  type DimensionResult,
  type PhotoQualityResult,
} from "@/modules/perception/schemas";
import {
  PerceptionUnavailableError,
  type DimensionInput,
  type PerceptionInput,
  type PerceptionObservation,
  type PerceptionPhoto,
  type PerceptionProvider,
} from "@/modules/perception/types";

const MAX_OUTPUT_TOKENS = 2048;

const SUPPORTED_IMAGE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type SupportedImageMediaType = (typeof SUPPORTED_IMAGE_MEDIA_TYPES)[number];

function asSupportedMediaType(contentType: string): SupportedImageMediaType {
  const normalized = contentType.trim().toLowerCase();

  const match = SUPPORTED_IMAGE_MEDIA_TYPES.find(
    (supported) => supported === normalized,
  );

  if (!match) {
    throw new PerceptionUnavailableError(
      `Claude cannot read a ${contentType} photograph. Supported types: ${SUPPORTED_IMAGE_MEDIA_TYPES.join(", ")}.`,
    );
  }

  return match;
}

function photoBlocks(
  photos: readonly PerceptionPhoto[],
): Anthropic.ContentBlockParam[] {
  return photos.flatMap((photo): Anthropic.ContentBlockParam[] => [
    { type: "text", text: `Photograph: ${photo.label}` },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: asSupportedMediaType(photo.contentType),
        data: photo.data.toString("base64"),
      },
    },
  ]);
}

function readFirstJsonText(message: Anthropic.Message): unknown {
  if (message.stop_reason === "refusal") {
    throw new Error(
      `Claude declined to answer: ${message.stop_details?.category ?? "unspecified"}`,
    );
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) throw new Error("Claude returned no text");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Claude returned text that was not JSON");
  }
}

async function callClaude({
  prompt,
  photos,
  responseSchema,
}: {
  prompt: string;
  photos: readonly PerceptionPhoto[];
  responseSchema: Record<string, unknown>;
}): Promise<{ parsed: unknown; model: string }> {
  const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = anthropicEnv();

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: responseSchema },
    },
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }, ...photoBlocks(photos)],
      },
    ],
  });

  return { parsed: readFirstJsonText(message), model: message.model };
}

const CLASSIFICATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    assetType: { type: "string" },
    issueType: { type: "string" },
    frameMaterialHint: { type: "string" },
    confidence: { type: "number" },
    reasoning: { type: "string" },
  },
  required: ["assetType", "issueType", "frameMaterialHint", "confidence"],
  additionalProperties: false,
};

const DIMENSION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string" },
    widthInches: { type: ["number", "null"] },
    heightInches: { type: ["number", "null"] },
    scaleReferenceUsed: { type: ["string", "null"] },
    confidence: { type: ["number", "null"] },
    reasoning: { type: "string" },
  },
  required: ["status", "reasoning"],
  additionalProperties: false,
};

const PHOTO_QUALITY_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overall: { type: "string" },
    problems: { type: "array", items: { type: "string" } },
    shouldRequestCornerCloseUp: { type: "boolean" },
  },
  required: ["overall", "problems", "shouldRequestCornerCloseUp"],
  additionalProperties: false,
};

function assertPhotosPresent(input: PerceptionInput): void {
  if (input.photos.length === 0) {
    throw new PerceptionUnavailableError(
      "No photographs to look at, so there is nothing to observe.",
    );
  }
}

function withoutNulls(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([, entry]) => entry !== null,
    ),
  );
}

function observed<T>(
  parse: (raw: unknown) => T,
  response: { parsed: unknown; model: string },
): PerceptionObservation<T> {
  return {
    value: parse(withoutNulls(response.parsed)),
    rawOutput: response.parsed,
    model: response.model,
  };
}

export function createAnthropicProvider(): PerceptionProvider {
  return {
    name: "anthropic",

    async classify(
      input: PerceptionInput,
    ): Promise<PerceptionObservation<ClassificationResult>> {
      assertPhotosPresent(input);

      return observed(
        (raw) => classificationResultSchema.parse(raw),
        await callClaude({
          prompt: classificationPrompt(input),
          photos: input.photos,
          responseSchema: CLASSIFICATION_RESPONSE_SCHEMA,
        }),
      );
    },

    async estimateDimensions(
      input: DimensionInput,
    ): Promise<PerceptionObservation<DimensionResult>> {
      assertPhotosPresent(input);

      return observed(
        (raw) => dimensionResultSchema.parse(raw),
        await callClaude({
          prompt: dimensionPrompt(input),
          photos: input.photos,
          responseSchema: DIMENSION_RESPONSE_SCHEMA,
        }),
      );
    },

    async assessPhotoQuality(
      input: PerceptionInput,
    ): Promise<PerceptionObservation<PhotoQualityResult>> {
      assertPhotosPresent(input);

      return observed(
        (raw) => photoQualityResultSchema.parse(raw),
        await callClaude({
          prompt: photoQualityPrompt(input),
          photos: input.photos,
          responseSchema: PHOTO_QUALITY_RESPONSE_SCHEMA,
        }),
      );
    },
  };
}
