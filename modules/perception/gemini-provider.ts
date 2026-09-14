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
}): Promise<unknown> {
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
    return JSON.parse(text);
  } catch {
    throw new Error("Gemini returned text that was not JSON");
  }
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

    async classify(input: PerceptionInput): Promise<ClassificationResult> {
      assertPhotosPresent(input);

      return classificationResultSchema.parse(
        await callGemini({
          prompt: classificationPrompt(input),
          photos: input.photos,
          responseSchema: CLASSIFICATION_RESPONSE_SCHEMA,
        }),
      );
    },

    async estimateDimensions(input: DimensionInput): Promise<DimensionResult> {
      assertPhotosPresent(input);

      return dimensionResultSchema.parse(
        await callGemini({
          prompt: dimensionPrompt(input),
          photos: input.photos,
          responseSchema: DIMENSION_RESPONSE_SCHEMA,
        }),
      );
    },

    async assessPhotoQuality(
      input: PerceptionInput,
    ): Promise<PhotoQualityResult> {
      assertPhotosPresent(input);

      return photoQualityResultSchema.parse(
        await callGemini({
          prompt: photoQualityPrompt(input),
          photos: input.photos,
          responseSchema: PHOTO_QUALITY_RESPONSE_SCHEMA,
        }),
      );
    },
  };
}
