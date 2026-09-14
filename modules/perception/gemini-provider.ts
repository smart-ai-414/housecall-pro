import { geminiEnv } from "@/core/config/env";
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

const GENERATIVE_LANGUAGE_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

function photoParts(photos: readonly PerceptionPhoto[]): GeminiPart[] {
  return photos.flatMap((photo) => [
    { text: `Photograph: ${photo.label}` },
    {
      inline_data: {
        mime_type: photo.contentType,
        data: photo.data.toString("base64"),
      },
    },
  ]);
}

function readFirstText(body: GeminiResponse): string {
  const blockReason = body.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini blocked the request: ${blockReason}`);
  }

  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("Gemini returned no text");

  return text;
}

async function callGemini({
  prompt,
  photos,
  responseSchema,
}: {
  prompt: string;
  photos: readonly PerceptionPhoto[];
  responseSchema: Record<string, unknown>;
}): Promise<{ parsed: unknown; model: string }> {
  const { GEMINI_API_KEY, GEMINI_MODEL } = geminiEnv();

  const response = await fetch(
    `${GENERATIVE_LANGUAGE_BASE_URL}/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: prompt }, ...photoParts(photos)] },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Gemini responded ${response.status}: ${detail}`);
  }

  const text = readFirstText((await response.json()) as GeminiResponse);

  try {
    return { parsed: JSON.parse(text), model: GEMINI_MODEL };
  } catch {
    throw new Error("Gemini returned text that was not JSON");
  }
}

function observed<T>(
  parse: (raw: unknown) => T,
  response: { parsed: unknown; model: string },
): PerceptionObservation<T> {
  return {
    value: parse(response.parsed),
    rawOutput: response.parsed,
    model: response.model,
  };
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
  required: ["assetType", "issueType", "confidence"],
};

const DIMENSION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string" },
    widthInches: { type: "number" },
    heightInches: { type: "number" },
    scaleReferenceUsed: { type: "string" },
    confidence: { type: "number" },
    reasoning: { type: "string" },
  },
  required: ["status"],
};

const PHOTO_QUALITY_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overall: { type: "string" },
    problems: { type: "array", items: { type: "string" } },
    shouldRequestCornerCloseUp: { type: "boolean" },
  },
  required: ["overall"],
};

function assertPhotosPresent(input: PerceptionInput): void {
  if (input.photos.length === 0) {
    throw new PerceptionUnavailableError(
      "No photographs to look at, so there is nothing to observe.",
    );
  }
}

export function createGeminiProvider(): PerceptionProvider {
  return {
    name: "gemini",

    async classify(
      input: PerceptionInput,
    ): Promise<PerceptionObservation<ClassificationResult>> {
      assertPhotosPresent(input);

      return observed(
        (raw) => classificationResultSchema.parse(raw),
        await callGemini({
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
        await callGemini({
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
        await callGemini({
          prompt: photoQualityPrompt(input),
          photos: input.photos,
          responseSchema: PHOTO_QUALITY_RESPONSE_SCHEMA,
        }),
      );
    },
  };
}
