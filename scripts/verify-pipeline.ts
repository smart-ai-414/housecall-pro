import { config as loadEnv } from "dotenv";
import sharp from "sharp";

loadEnv({ path: ".env", quiet: true });

import {
  detectImageFormat,
  ImageRejectedError,
  processPhotoForAnalysis,
  readImageHeader,
} from "../modules/photos/image-processing";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "../core/security/encryption";
import {
  createResumeToken,
  verifyResumeToken,
} from "../core/security/resume-token";
import {
  RESUME_TOKEN_TTL_DAYS,
  RESUME_TOKEN_TTL_MS,
} from "../core/security/resume-token-policy";
import {
  createPhotoAccessToken,
  PHOTO_ACCESS_TTL_DAYS,
  verifyPhotoAccessToken,
} from "../core/security/photo-access-token";
import {
  extractZipCode,
  isPointInsideBoundary,
} from "../modules/tenancy/territory-routing";
import { assessIntakeCompleteness } from "../modules/intake/completion";
import {
  conversationalQuestionsIn,
  DORMANT_QUESTION_IDS,
  MAX_QUESTIONS_PER_SESSION,
  OPENING_QUESTION_SEQUENCE,
  PERCEPTION_DRIVEN_QUESTION_IDS,
  QUESTION_BANK,
  QUESTIONS_NOT_ANSWERABLE_BY_FREE_TEXT,
  SAFETY_GLAZING_QUESTION_ID,
  safetyGlazingMayBeRequired,
} from "../modules/intake/question-bank";
import {
  CORNER_CLOSEUP_REQUEST_MESSAGE,
  outstandingPhotoTypesFor,
} from "../modules/photos/photo-requirements";
import { priceBandFor } from "../modules/perception/price-bands";
import { assessPricingGate } from "../modules/perception/pricing-gate";
import {
  buildLineItemsFromCatalogueMatches,
  PLACEHOLDER_LINE_ITEM_NAME,
} from "../modules/housecall-pro/estimates";
import {
  NON_CATALOGUE_TEMPLATE,
  renderNonCatalogueTemplate,
} from "../modules/estimates/non-catalogue-template";
import {
  renderNotes,
  type StructuredNotesHeader,
} from "../modules/estimates/estimate-notes";
import {
  classificationIsUsable,
  classificationResultSchema,
  dimensionResultSchema,
  squareFootageOf,
} from "../modules/perception/schemas";
import {
  ladderFor,
  MINIMUM_SIGHTINGS_TO_MATCH,
  SERVICE_FAMILIES,
} from "../modules/pricing/catalogue-families";
import { matchCatalogue } from "../modules/pricing/catalogue-matcher";
import { ASSET_PRICING_RULES } from "../modules/pricing/matching-rules";
import {
  catalogueSnapshotExportedAt,
  loadCatalogueSnapshot,
} from "../modules/pricing/catalogue-snapshot";
import { assetTypeSchema } from "../modules/perception/schemas";
import { resolveProviderName } from "../modules/perception/provider-registry";
import {
  classify,
  PERCEPTION_MAX_ATTEMPTS,
} from "../modules/perception/perception-service";
import type { PerceptionProvider } from "../modules/perception/types";

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  const mark = condition ? "PASS" : "FAIL";
  if (!condition) failures += 1;
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\nIMAGE FORMAT DETECTION (magic bytes, not extension)");

  const jpeg = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#4488cc" },
  })
    .jpeg()
    .toBuffer();

  const png = await sharp({
    create: { width: 640, height: 480, channels: 4, background: "#112233" },
  })
    .png()
    .toBuffer();

  const webp = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#ff8800" },
  })
    .webp()
    .toBuffer();

  check("JPEG detected", detectImageFormat(jpeg) === "jpeg");
  check("PNG detected", detectImageFormat(png) === "png");
  check("WebP detected", detectImageFormat(webp) === "webp");

  const disguisedScript = Buffer.from(
    "<?php system($_GET['c']); ?>".padEnd(64, " "),
    "utf8",
  );
  check(
    "PHP file named .jpg is rejected",
    detectImageFormat(disguisedScript) === null,
  );

  console.log("\nHEADER DIMENSIONS (read before decode)");
  const jpegHeader = readImageHeader(jpeg);
  check(
    "JPEG header 1200x800",
    jpegHeader.width === 1200 && jpegHeader.height === 800,
    `${jpegHeader.width}x${jpegHeader.height}`,
  );

  const pngHeader = readImageHeader(png);
  check(
    "PNG header 640x480",
    pngHeader.width === 640 && pngHeader.height === 480,
    `${pngHeader.width}x${pngHeader.height}`,
  );

  const webpHeader = readImageHeader(webp);
  check(
    "WebP header 300x200",
    webpHeader.width === 300 && webpHeader.height === 200,
    `${webpHeader.width}x${webpHeader.height}`,
  );

  try {
    readImageHeader(disguisedScript);
    check("Unrecognised format throws", false);
  } catch (error) {
    check(
      "Unrecognised format throws UNRECOGNISED_FORMAT",
      error instanceof ImageRejectedError &&
        error.reason === "UNRECOGNISED_FORMAT",
    );
  }

  console.log("\nDECOMPRESSION BOMB GUARD");
  const bombHeader = Buffer.alloc(32);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(
    bombHeader,
    0,
  );
  bombHeader.write("IHDR", 12, "latin1");
  bombHeader.writeUInt32BE(50000, 16);
  bombHeader.writeUInt32BE(50000, 20);

  try {
    readImageHeader(bombHeader);
    check("50000x50000 PNG rejected", false);
  } catch (error) {
    check(
      "50000x50000 PNG rejected from header alone",
      error instanceof ImageRejectedError &&
        error.reason === "DIMENSIONS_TOO_LARGE",
    );
  }

  console.log(
    "\nPROCESSING: EXIF ORIENTATION THEN STRIP, UNCONDITIONAL RE-ENCODE",
  );

  const rotatedWithGps = await sharp({
    create: { width: 900, height: 1600, channels: 3, background: "#336699" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

  const beforeMeta = await sharp(rotatedWithGps).metadata();
  check(
    "Input has EXIF orientation 6 and metadata",
    beforeMeta.orientation === 6 && Boolean(beforeMeta.exif),
    `orientation=${beforeMeta.orientation}`,
  );

  const processed = await processPhotoForAnalysis(rotatedWithGps);
  const afterMeta = await sharp(processed.buffer).metadata();

  check(
    "Orientation applied (portrait became landscape)",
    afterMeta.width! > afterMeta.height!,
    `${afterMeta.width}x${afterMeta.height}`,
  );
  check(
    "EXIF stripped after orientation applied",
    afterMeta.exif === undefined,
    afterMeta.exif ? "exif still present" : "no exif block",
  );
  check(
    "Orientation tag no longer set",
    afterMeta.orientation === undefined || afterMeta.orientation === 1,
    `orientation=${afterMeta.orientation}`,
  );
  check("Re-encoded as JPEG", afterMeta.format === "jpeg");
  check(
    "Flags recorded for the database",
    processed.exifOrientationApplied && processed.metadataStripped,
  );
  check(
    "Original dimensions preserved for the record",
    processed.originalWidth === 900 && processed.originalHeight === 1600,
    `${processed.originalWidth}x${processed.originalHeight}`,
  );

  const large = await sharp({
    create: { width: 6000, height: 4000, channels: 3, background: "#222222" },
  })
    .jpeg()
    .toBuffer();
  const shrunk = await processPhotoForAnalysis(large);
  check(
    "Oversized photo capped to 2048 long edge",
    Math.max(shrunk.width, shrunk.height) === 2048,
    `${shrunk.width}x${shrunk.height}`,
  );

  console.log("\nENCRYPTION AT REST (AES-256-GCM)");
  const apiKey = "hcp_live_2f8a9c4d6e1b3a5f7c9e0d2b4a6f8c1e";
  const ciphertext = encryptSecret(apiKey);
  check("Ciphertext is versioned", ciphertext.startsWith("v1."));
  check(
    "Ciphertext does not contain the plaintext",
    !ciphertext.includes(apiKey),
  );
  check("Round-trips", decryptSecret(ciphertext) === apiKey);
  check("Two encryptions differ", encryptSecret(apiKey) !== ciphertext);
  check(
    "Mask shows only last four",
    maskSecret(apiKey) === "••••8c1e",
    maskSecret(apiKey),
  );

  const parts = ciphertext.split(".");
  const tamperedBody = Buffer.from(parts[3], "base64url");
  tamperedBody[0] ^= 0xff;
  const tampered = [
    parts[0],
    parts[1],
    parts[2],
    tamperedBody.toString("base64url"),
  ].join(".");

  try {
    decryptSecret(tampered);
    check("Tampered ciphertext rejected", false);
  } catch {
    check("Tampered ciphertext rejected by the auth tag", true);
  }

  console.log("\nRESUME TOKENS (HMAC-signed)");
  const sessionId = "3f2a5b8c-1d4e-4a6b-8c9d-0e1f2a3b4c5d";
  const otherSessionId = "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d";
  const token = createResumeToken(sessionId);

  check(
    "Verifies and returns the session",
    verifyResumeToken(token)?.sessionId === sessionId,
  );
  check(
    "Two tokens for one session differ",
    createResumeToken(sessionId) !== token,
  );
  check(
    "Rejects a flipped character",
    verifyResumeToken(token.slice(0, -1) + "Z") === null,
  );
  check(
    "Rejects a truncated token",
    verifyResumeToken(token.slice(0, 20)) === null,
  );

  const swapped = [otherSessionId, ...token.split(".").slice(1)].join(".");
  check(
    "Rejects a token repointed at another session",
    verifyResumeToken(swapped) === null,
  );

  const verified = verifyResumeToken(token);
  check(
    `Carries a ${RESUME_TOKEN_TTL_DAYS}-day expiry`,
    verified !== null &&
      verified.expiresAt.getTime() - verified.issuedAt.getTime() ===
        RESUME_TOKEN_TTL_MS,
  );

  const tokenParts = token.split(".");
  const stretched = [
    tokenParts[0],
    tokenParts[1],
    (Date.now() + RESUME_TOKEN_TTL_MS * 10).toString(36),
    tokenParts[3],
  ].join(".");
  check(
    "Rejects a token whose expiry was stretched",
    verifyResumeToken(stretched) === null,
  );

  console.log("\nPHOTO ACCESS TOKENS (durable links in estimate notes)");
  const photoId = "018f2c3d-4e5a-7b6c-8d9e-0f1a2b3c4d5e";
  const photoToken = createPhotoAccessToken(photoId);

  check(
    "Verifies and returns the photo",
    verifyPhotoAccessToken(photoToken)?.photoId === photoId,
  );
  check(
    "Rejects a flipped character",
    verifyPhotoAccessToken(photoToken.slice(0, -1) + "Z") === null,
  );
  check(
    "A resume token is not a photo token",
    verifyPhotoAccessToken(token) === null,
  );
  check(
    "A photo token is not a resume token",
    verifyResumeToken(photoToken) === null,
  );
  check(
    `Outlives a reviewer's working window (${PHOTO_ACCESS_TTL_DAYS} days)`,
    PHOTO_ACCESS_TTL_DAYS >= 30,
  );

  console.log("\nTERRITORY ROUTING");
  check(
    "ZIP taken from the end of an address",
    extractZipCode("123 Main St, Minneapolis, MN 55401") === "55401",
  );
  check(
    "ZIP+4 handled",
    extractZipCode("9 Oak Ave, Edina, MN 55424-1234") === "55424",
  );
  check(
    "No ZIP returns null",
    extractZipCode("Behind the big red barn") === null,
  );

  const square = {
    type: "Polygon" as const,
    coordinates: [
      [
        [-93.3, 44.9],
        [-93.1, 44.9],
        [-93.1, 45.1],
        [-93.3, 45.1],
        [-93.3, 44.9],
      ] as [number, number][],
    ],
  };
  check(
    "Point inside boundary",
    isPointInsideBoundary({ latitude: 45.0, longitude: -93.2 }, square),
  );
  check(
    "Point outside boundary",
    !isPointInsideBoundary({ latitude: 45.0, longitude: -92.0 }, square),
  );

  console.log("\nINTAKE COMPLETENESS (what triggers the sync)");

  const fullyAnswered = {
    hasName: true,
    hasPhoneOrEmail: true,
    hasServiceAddress: true,
    isRouted: true,
    outstandingPhotoTypes: [],
    outstandingQuestions: [],
  };

  check(
    "A fully answered session is complete",
    assessIntakeCompleteness(fullyAnswered).isComplete,
  );
  check(
    "An unrouted session is never complete",
    !assessIntakeCompleteness({ ...fullyAnswered, isRouted: false }).isComplete,
  );
  check(
    "A missing photo blocks completion",
    !assessIntakeCompleteness({
      ...fullyAnswered,
      outstandingPhotoTypes: ["EXTERIOR_FULL_ELEVATION"],
    }).isComplete,
  );
  check(
    "An unanswered banked question blocks completion",
    !assessIntakeCompleteness({
      ...fullyAnswered,
      outstandingQuestions: ["WHAT_HAPPENED"],
    }).isComplete,
  );
  check(
    "An unknown question id does not block completion",
    assessIntakeCompleteness({
      ...fullyAnswered,
      outstandingQuestions: ["NOT_IN_THE_BANK"],
    }).isComplete,
  );
  check(
    "No contact route means no sync",
    !assessIntakeCompleteness({ ...fullyAnswered, hasPhoneOrEmail: false })
      .isComplete,
  );

  const missingEverything = assessIntakeCompleteness({
    hasName: false,
    hasPhoneOrEmail: false,
    hasServiceAddress: false,
    isRouted: false,
    outstandingPhotoTypes: ["INTERIOR_FLOOR_TO_CEILING"],
    outstandingQuestions: ["WHAT_HAPPENED"],
  });
  check(
    "Every unmet requirement is reported, not just the first",
    missingEverything.missing.length === 5,
    `${missingEverything.missing.join(", ")}`,
  );

  console.log("\nSAFETY GLAZING (asked, never inferred)");

  check(
    "The question is in the bank",
    SAFETY_GLAZING_QUESTION_ID in QUESTION_BANK,
  );
  check(
    "Every customer is asked it",
    OPENING_QUESTION_SEQUENCE.includes(SAFETY_GLAZING_QUESTION_ID),
  );
  check(
    "Unanswered is unknown, never a negative",
    safetyGlazingMayBeRequired(null) === null &&
      safetyGlazingMayBeRequired("") === null,
  );
  check(
    '"Not sure" is unknown, never a negative',
    safetyGlazingMayBeRequired("Not sure") === null,
  );
  check(
    "A triggering location flags it",
    safetyGlazingMayBeRequired("Right beside a door") === true &&
      safetyGlazingMayBeRequired("In a bathroom or shower") === true,
  );
  check(
    "Only an explicit denial clears it",
    safetyGlazingMayBeRequired("None of these") === false,
  );
  check(
    "An unrecognised answer errs toward flagging",
    safetyGlazingMayBeRequired("it is above the kitchen sink") === true,
  );

  console.log("\nPERCEPTION SCHEMAS (closed sets, unknown always allowed)");

  check(
    "A well-formed classification parses",
    classificationResultSchema.safeParse({
      assetType: "RESIDENTIAL_WINDOW",
      issueType: "CRACKED",
      confidence: 0.82,
    }).success,
  );
  check(
    "UNKNOWN is a valid answer, not an error",
    classificationResultSchema.safeParse({
      assetType: "UNKNOWN",
      issueType: "UNKNOWN",
      confidence: 0.1,
    }).success,
  );
  check(
    "An invented asset type is rejected",
    !classificationResultSchema.safeParse({
      assetType: "GREENHOUSE",
      issueType: "CRACKED",
      confidence: 0.9,
    }).success,
  );
  check(
    "Confidence outside 0..1 is rejected",
    !classificationResultSchema.safeParse({
      assetType: "RESIDENTIAL_WINDOW",
      issueType: "CRACKED",
      confidence: 1.4,
    }).success,
  );
  check(
    "Frame material defaults to UNKNOWN when absent",
    classificationResultSchema.parse({
      assetType: "RESIDENTIAL_WINDOW",
      issueType: "CRACKED",
      confidence: 0.8,
    }).frameMaterialHint === "UNKNOWN",
  );
  check(
    "A dimension estimate without a scale reference is rejected",
    !dimensionResultSchema.safeParse({
      status: "ESTIMATED",
      widthInches: 36,
      heightInches: 60,
      confidence: 0.8,
    }).success,
  );
  check(
    "NO_REFERENCE_FOUND needs no measurements",
    dimensionResultSchema.safeParse({ status: "NO_REFERENCE_FOUND" }).success,
  );
  check(
    "Square footage is derived, never taken from the model",
    squareFootageOf(36, 48) === 12,
    `${squareFootageOf(36, 48)} sq ft from 36x48in`,
  );
  check(
    "An unknown classification is never usable for pricing",
    !classificationIsUsable({
      assetType: "UNKNOWN",
      issueType: "CRACKED",
      frameMaterialHint: "UNKNOWN",
      confidence: 0.99,
    }),
  );
  check(
    "A low-confidence classification is never usable for pricing",
    !classificationIsUsable({
      assetType: "RESIDENTIAL_WINDOW",
      issueType: "CRACKED",
      frameMaterialHint: "UNKNOWN",
      confidence: 0.4,
    }),
  );

  console.log("\nPERCEPTION ROUTING (plan 5.1: config, not code changes)");

  check(
    "Defaults to Gemini, as the plan specifies",
    resolveProviderName("classify", {}) === "gemini",
  );
  check(
    "One variable reroutes every function",
    resolveProviderName("classify", { PERCEPTION_PROVIDER: "anthropic" }) ===
      "anthropic",
  );
  check(
    "A single function can be routed on its own",
    resolveProviderName("estimateDimensions", {
      PERCEPTION_PROVIDER: "gemini",
      PERCEPTION_PROVIDER_DIMENSIONS: "anthropic",
    }) === "anthropic" &&
      resolveProviderName("classify", {
        PERCEPTION_PROVIDER: "gemini",
        PERCEPTION_PROVIDER_DIMENSIONS: "anthropic",
      }) === "gemini",
  );

  let rejectedUnknownProvider = false;
  try {
    resolveProviderName("classify", { PERCEPTION_PROVIDER: "gpt4" });
  } catch {
    rejectedUnknownProvider = true;
  }
  check("An unknown provider name is refused", rejectedUnknownProvider);

  console.log("\nPERCEPTION FAIL-THROUGH (a failure must still leave a lead)");

  const perceptionInput = {
    photos: [
      { label: "inside", contentType: "image/jpeg", data: Buffer.from("x") },
    ],
    customerDescription: "cracked pane",
  };

  let attempts = 0;
  const alwaysFails = {
    name: "always-fails",
    classify: async () => {
      attempts += 1;
      throw new Error("provider exploded");
    },
    estimateDimensions: async () => {
      throw new Error("unused");
    },
    assessPhotoQuality: async () => {
      throw new Error("unused");
    },
  } as unknown as PerceptionProvider;

  const failed = await classify(perceptionInput, { provider: alwaysFails });

  check(
    "A failing provider never throws at the caller",
    failed.status === "FAILED",
  );
  check(
    "It retries exactly once, then gives up",
    attempts === PERCEPTION_MAX_ATTEMPTS && PERCEPTION_MAX_ATTEMPTS === 2,
    `${attempts} attempts`,
  );
  check(
    "The reason is carried for the human queue",
    failed.status === "FAILED" && failed.reason.includes("provider exploded"),
  );

  const hangs = {
    name: "hangs",
    classify: () => new Promise(() => {}),
    estimateDimensions: async () => {
      throw new Error("unused");
    },
    assessPhotoQuality: async () => {
      throw new Error("unused");
    },
  } as unknown as PerceptionProvider;

  const timedOut = await classify(perceptionInput, {
    provider: hangs,
    timeoutMs: 50,
  });

  check(
    "A hung provider times out rather than hanging the request",
    timedOut.status === "FAILED",
  );

  const succeeds = {
    name: "succeeds",
    classify: async () => ({
      value: {
        assetType: "RESIDENTIAL_WINDOW" as const,
        issueType: "CRACKED" as const,
        frameMaterialHint: "UNKNOWN" as const,
        confidence: 0.9,
      },
      rawOutput: { assetType: "RESIDENTIAL_WINDOW" },
      model: "test-model-1",
    }),
    estimateDimensions: async () => {
      throw new Error("unused");
    },
    assessPhotoQuality: async () => {
      throw new Error("unused");
    },
  } as unknown as PerceptionProvider;

  const ok = await classify(perceptionInput, { provider: succeeds });
  check(
    "A working provider returns on the first attempt",
    ok.status === "OK" && ok.attempts === 1,
  );
  check(
    "Provenance travels with the answer, so raw output and model can be stored",
    ok.status === "OK" &&
      ok.model === "test-model-1" &&
      ok.rawOutput !== undefined,
  );

  console.log(
    "\nCONFIDENCE ROUTING (a bad photo becomes a callback, not a price)",
  );

  const usableClassification = {
    assetType: "SLIDING_DOOR" as const,
    issueType: "SEAL_FAILURE" as const,
    frameMaterialHint: "VINYL" as const,
    confidence: 0.82,
  };

  check(
    "A confident, known classification does not bypass pricing",
    assessPricingGate({
      classification: usableClassification,
      photoQuality: {
        overall: "GOOD",
        problems: [],
        shouldRequestCornerCloseUp: false,
      },
    }).shouldBypassPricing === false,
  );
  check(
    "Confidence below the threshold bypasses pricing",
    assessPricingGate({
      classification: { ...usableClassification, confidence: 0.4 },
      photoQuality: null,
    }).shouldBypassPricing,
  );
  check(
    "An unknown asset type bypasses pricing however confident the model is",
    assessPricingGate({
      classification: {
        ...usableClassification,
        assetType: "UNKNOWN",
        confidence: 0.99,
      },
      photoQuality: null,
    }).shouldBypassPricing,
  );
  check(
    "Unusable photographs bypass pricing however confident the model is",
    assessPricingGate({
      classification: { ...usableClassification, confidence: 0.99 },
      photoQuality: {
        overall: "UNUSABLE",
        problems: ["too dark"],
        shouldRequestCornerCloseUp: false,
      },
    }).shouldBypassPricing,
  );
  check(
    "A failed classification bypasses pricing rather than pricing nothing",
    assessPricingGate({ classification: null, photoQuality: null })
      .shouldBypassPricing,
  );
  check(
    "The bypass carries a reason a reviewer can read",
    assessPricingGate({
      classification: { ...usableClassification, confidence: 0.1 },
      photoQuality: null,
    }).reasons.length > 0,
  );

  console.log(
    "\nPRICE BANDS (dimension accuracy is judged by band, not by inch)",
  );

  check(
    "A small pane lands in the smallest band",
    priceBandFor(5) === "UP_TO_7_SQFT",
  );
  check(
    "A band boundary belongs to the lower band",
    priceBandFor(10) === "8_TO_10_SQFT",
  );
  check(
    "A patio door lands in the largest band",
    priceBandFor(40) === "OVER_30_SQFT",
  );
  check(
    "A one-inch error does not move the band",
    priceBandFor(squareFootageOf(72, 80)) ===
      priceBandFor(squareFootageOf(73, 80)),
  );

  console.log(
    "\nCONDITIONAL THIRD PHOTO (two up front, a third only when asked for)",
  );

  check(
    "Only two photographs are required up front",
    outstandingPhotoTypesFor({ received: [], requested: [], declined: [] })
      .length === 2,
  );
  check(
    "Nothing is outstanding once both required photographs arrive",
    outstandingPhotoTypesFor({
      received: ["INTERIOR_FLOOR_TO_CEILING", "EXTERIOR_FULL_ELEVATION"],
      requested: [],
      declined: [],
    }).length === 0,
  );
  check(
    "A requested close-up becomes outstanding",
    outstandingPhotoTypesFor({
      received: ["INTERIOR_FLOOR_TO_CEILING", "EXTERIOR_FULL_ELEVATION"],
      requested: ["CORNER_CLOSEUP"],
      declined: [],
    }).includes("CORNER_CLOSEUP"),
  );
  check(
    "A customer who cannot take it is not held up by it",
    outstandingPhotoTypesFor({
      received: ["INTERIOR_FLOOR_TO_CEILING", "EXTERIOR_FULL_ELEVATION"],
      requested: ["CORNER_CLOSEUP"],
      declined: ["CORNER_CLOSEUP"],
    }).length === 0,
  );
  check(
    "The close-up request explains why it is being asked for",
    CORNER_CLOSEUP_REQUEST_MESSAGE.toLowerCase().includes("frame type"),
  );

  console.log("\nESTIMATE NOTES (what the reviewer reads without scrolling)");

  const notesHeader: StructuredNotesHeader = {
    source: "GlassBot intake",
    reason: "COMPLETED_INTAKE",
    environment: "non-production",
    sessionId: "0197b1c4-0000-7000-8000-000000000000",
    observed: {
      assetType: "SLIDING_DOOR",
      issueType: "SEAL_FAILURE",
      frameMaterialHint: "VINYL",
      classificationConfidence: 0.78,
      lowConfidence: false,
      photoQuality: "GOOD",
      photoQualityProblems: [],
      summary: "A sliding patio door with fogging between the panes.",
      modelVersion: "gemini:gemini-2.5-flash",
    },
    measurements: {
      widthInches: 72,
      heightInches: 80,
      squareFootage: 40,
      priceBand: "OVER_30_SQFT",
      scaleReference: "HEAD_HEIGHT",
      scaleReferenceNote: "Head height visible at about 82 inches.",
      dimensionConfidence: 0.65,
      customerConfirmed: false,
      customerCorrected: false,
    },
    pricing: { bypassed: false, reasons: [] },
    pricingTemplateApplies: true,
    customerSaid: [],
    safetyGlazing: {
      answered: true,
      mayBeRequired: true,
      answer: "Right beside a door",
    },
    unresolved: ["Frame material", "Pane count"],
    reviewerMustCheck: ["The customer never confirmed the measurements."],
    photos: [],
  };

  const notes = renderNotes(notesHeader);

  check(
    "The observation is separated from what the customer confirmed",
    notes.includes("OBSERVED BY THE ASSISTANT (not verified)"),
  );
  check(
    "An unconfirmed measurement says so where a reviewer will see it",
    notes.includes("Customer confirmation: pending"),
  );
  check(
    "The scale reference the model used is quoted, not just named",
    notes.includes("Head height visible at about 82 inches"),
  );
  check(
    "Square footage and the size band both appear",
    notes.includes("40.0 sq ft") && notes.includes("over 30 sq ft"),
  );
  check(
    "The model that produced the reading is recorded for replay",
    notes.includes("gemini:gemini-2.5-flash"),
  );
  check(
    "Unresolved items are counted, not buried",
    notes.includes("UNRESOLVED (2)"),
  );
  check(
    "Safety glazing keeps its own heading",
    notes.includes("SAFETY GLAZING: MAY BE REQUIRED"),
  );

  const bypassed = renderNotes({
    ...notesHeader,
    pricing: {
      bypassed: true,
      reasons: ["Classification confidence was 31%."],
    },
  });

  check(
    "A bypassed job says so in the first lines of the notes",
    bypassed.indexOf("pricing bypassed") <
      bypassed.indexOf("OBSERVED BY THE ASSISTANT"),
  );

  const currencyInNotes = /[$£€]|\bunit_price\b|\bamount\b/.exec(
    notes.replace(renderNonCatalogueTemplate().join("\n"), ""),
  );

  check(
    "The assistant states no price anywhere in the notes it writes",
    currencyInNotes === null,
    currencyInNotes ? `found ${currencyInNotes[0]}` : "",
  );

  console.log("\nQUESTION BANK (plan 3.4 equipment and access)");

  const asked = conversationalQuestionsIn(OPENING_QUESTION_SEQUENCE);

  check(
    "Storey is asked — the plan's highest-value question",
    asked.includes("ACCESS_HEIGHT"),
  );
  check("Fixed versus operable is asked", asked.includes("FIXED_VS_OPERABLE"));
  check(
    "Conversational questions stay within the plan's cap",
    asked.length <= MAX_QUESTIONS_PER_SESSION,
    `${asked.length} asked, cap ${MAX_QUESTIONS_PER_SESSION}`,
  );
  check(
    "Every scheduled question exists in the bank",
    OPENING_QUESTION_SEQUENCE.every((id) => id in QUESTION_BANK),
  );
  check(
    "Dormant questions are defined but not yet scheduled",
    DORMANT_QUESTION_IDS.every(
      (id) => id in QUESTION_BANK && !OPENING_QUESTION_SEQUENCE.includes(id),
    ),
    DORMANT_QUESTION_IDS.join(", "),
  );
  check(
    "Every question in the bank is scheduled, dormant, or perception-driven",
    Object.keys(QUESTION_BANK).every(
      (id) =>
        OPENING_QUESTION_SEQUENCE.includes(id as never) ||
        DORMANT_QUESTION_IDS.includes(id as never) ||
        PERCEPTION_DRIVEN_QUESTION_IDS.includes(id as never),
    ),
  );
  check(
    "Dimension confirmation is never answered by a stray free-text message",
    QUESTIONS_NOT_ANSWERABLE_BY_FREE_TEXT.includes("DIMENSION_CONFIRMATION"),
  );

  console.log("\nNON-CATALOGUE PRICING TEMPLATE (reviewer reference only)");

  const template = renderNonCatalogueTemplate();
  const templateText = template.join("\n");

  check(
    "All four template lines are reproduced",
    NON_CATALOGUE_TEMPLATE.length === 4 &&
      ["Service call", "Material", "Labour", "Miscellaneous"].every((label) =>
        templateText.includes(label),
      ),
  );
  check(
    "The plan's figures are intact",
    templateText.includes("$105") &&
      templateText.includes("x 1.5") &&
      templateText.includes("$75") &&
      templateText.includes("$50 to $100"),
  );
  check(
    "It states the assistant does not apply it",
    templateText.toLowerCase().includes("does not apply"),
  );

  console.log("\nESTIMATE LINE ITEMS (Housecall Pro shape)");

  const lineItems = buildLineItemsFromCatalogueMatches([
    {
      housecallProServiceId: "olit_7d81a47acff4444fa1b412722f5f709d",
      serviceName: "25 SqFt Residential Glass Replacement",
      quantity: 1,
      isBaseItem: true,
      isAdditionalOpening: false,
      openingIndex: null,
    },
    {
      housecallProServiceId: "olit_e7b87f1b0cba4b5389e5e9566bb42d4e",
      serviceName: "12 SqFt Residential Glass Replacement",
      quantity: 1,
      isBaseItem: false,
      isAdditionalOpening: true,
      openingIndex: 2,
    },
  ]);

  check(
    "Line items reference a catalogue service_item_id",
    lineItems.every((item) => item.service_item_id?.startsWith("olit_")),
  );
  check(
    "No currency amount is ever generated",
    lineItems.every((item) => !("unit_price" in item) && !("amount" in item)),
  );
  check(
    "Additional openings are labelled for the reviewer",
    lineItems[1].description === "Opening 2",
  );
  const placeholderOnly = buildLineItemsFromCatalogueMatches([]);

  check(
    "An unmatched job still gets exactly one line item",
    placeholderOnly.length === 1,
    `${placeholderOnly.length} emitted`,
  );
  check(
    "That line is the placeholder",
    placeholderOnly[0].name === PLACEHOLDER_LINE_ITEM_NAME,
  );
  check(
    "The placeholder carries no price and no service item",
    !("unit_price" in placeholderOnly[0]) &&
      !("amount" in placeholderOnly[0]) &&
      !("unit_cost" in placeholderOnly[0]) &&
      placeholderOnly[0].service_item_id === undefined,
  );
  check(
    "The placeholder tells the reviewer to replace it",
    (placeholderOnly[0].description ?? "").toLowerCase().includes("replace"),
  );

  check(
    "Line items are emitted in a stable order",
    lineItems[0].order_index === 0 && lineItems[1].order_index === 1,
    "Housecall Pro discards order_index on create; this asserts our own output",
  );

  console.log(
    "\nCATALOGUE MATCHING (deterministic, no model in the pricing path)",
  );

  const snapshot = loadCatalogueSnapshot();

  check(
    "The catalogue snapshot parses and carries banded items",
    snapshot.squareFootageBanded.length > 0,
    `${snapshot.squareFootageBanded.length} banded of ${snapshot.allServiceItems.length} items`,
  );
  check(
    "The snapshot records no price field of any kind",
    JSON.stringify(snapshot).match(
      /"(unit_price|amount|total|price|cost)"/i,
    ) === null,
  );

  const residentialLadder = ladderFor("RESIDENTIAL");

  check(
    "The residential ladder is the one the price book actually carries",
    residentialLadder.map((rung) => rung.maximumSquareFeet).join(",") ===
      "7,10,12,18,25",
    residentialLadder.map((rung) => rung.maximumSquareFeet).join(", "),
  );
  check(
    "Every rung is a distinct catalogue id",
    new Set(residentialLadder.map((rung) => rung.serviceItemId)).size ===
      residentialLadder.length,
  );
  check(
    "A single-sighting item never becomes a rung",
    SERVICE_FAMILIES.every((family) =>
      ladderFor(family).every(
        (rung) => rung.timesSeen >= MINIMUM_SIGHTINGS_TO_MATCH,
      ),
    ),
    `minimum ${MINIMUM_SIGHTINGS_TO_MATCH} sightings`,
  );
  check(
    "The sliding door ladder drops the lone blind-inside long-lead item",
    ladderFor("SLIDING_DOOR").every((rung) => rung.maximumSquareFeet !== 18),
  );

  check(
    "Every asset type the model can return has a pricing rule",
    assetTypeSchema.options.every(
      (assetType) => ASSET_PRICING_RULES[assetType] !== undefined,
    ),
  );
  check(
    "Every unmatchable asset type explains itself to the reviewer",
    Object.values(ASSET_PRICING_RULES).every(
      (rule) =>
        rule.isBandMatchable ||
        (rule.reasonNotMatchable !== null &&
          rule.reasonNotMatchable.length > 20),
    ),
  );

  const residentialMatch = matchCatalogue({
    assetType: "RESIDENTIAL_WINDOW",
    squareFeet: 9,
    dimensionSource: "CUSTOMER_MEASURED",
    shouldBypassPricing: false,
  });

  check(
    "A residential window matches the smallest band that covers it",
    residentialMatch.status === "MATCHED" &&
      residentialMatch.matches.some((match) =>
        match.serviceName.includes("10"),
      ),
    residentialMatch.matches.map((match) => match.serviceName).join(" + "),
  );
  check(
    "The service call is proposed once, as the base item",
    residentialMatch.matches.filter((match) => match.isBaseItem).length === 1,
  );
  check(
    "No proposed match carries a price of any kind",
    residentialMatch.matches.every(
      (match) =>
        !("unitPrice" in match) &&
        !("amount" in match) &&
        !("price" in match) &&
        !("total" in match),
    ),
  );
  check(
    "A measurement the customer took is not second-guessed at the band edge",
    matchCatalogue({
      assetType: "RESIDENTIAL_WINDOW",
      squareFeet: 12,
      dimensionSource: "CUSTOMER_MEASURED",
      shouldBypassPricing: false,
    }).reasons.length === 0,
  );

  const borderline = matchCatalogue({
    assetType: "RESIDENTIAL_WINDOW",
    squareFeet: 12,
    dimensionSource: "CUSTOMER_CONFIRMED",
    shouldBypassPricing: false,
  });

  check(
    "An estimate sitting on a band edge warns the reviewer",
    borderline.status === "MATCHED" && borderline.reasons.length > 0,
  );
  check(
    "That warning costs the match its confidence",
    borderline.matches
      .filter((match) => !match.isBaseItem)
      .every((match) => match.matchConfidence < 0.7),
  );

  const unconfirmed = matchCatalogue({
    assetType: "RESIDENTIAL_WINDOW",
    squareFeet: 9,
    dimensionSource: "UNCONFIRMED",
    shouldBypassPricing: false,
  });

  check(
    "An unconfirmed measurement lowers the match confidence",
    unconfirmed.matches
      .filter((match) => !match.isBaseItem)
      .every((match) => match.matchConfidence < 0.9),
  );

  const offLadder = matchCatalogue({
    assetType: "RESIDENTIAL_WINDOW",
    squareFeet: 60,
    dimensionSource: "CUSTOMER_MEASURED",
    shouldBypassPricing: false,
  });

  check(
    "An opening past the top of the ladder is not force-fitted",
    offLadder.status === "NO_MATCH" && offLadder.matches.length === 0,
  );
  check(
    "It says why, in words a reviewer can act on",
    offLadder.reasons.some((reason) => reason.includes("25 sq ft")),
  );

  check(
    "Commercial storefront is never band-matched from a photograph",
    matchCatalogue({
      assetType: "COMMERCIAL_STOREFRONT",
      squareFeet: 20,
      dimensionSource: "CUSTOMER_MEASURED",
      shouldBypassPricing: false,
    }).status === "NO_MATCH",
    "bands sit 1.4% apart per axis",
  );
  check(
    "Shower glass is never band-matched",
    matchCatalogue({
      assetType: "SHOWER_GLASS",
      squareFeet: 18,
      dimensionSource: "CUSTOMER_MEASURED",
      shouldBypassPricing: false,
    }).status === "NO_MATCH",
    "priced by configuration, not square footage",
  );
  check(
    "A bypassed session is never matched at all",
    matchCatalogue({
      assetType: "RESIDENTIAL_WINDOW",
      squareFeet: 9,
      dimensionSource: "CUSTOMER_MEASURED",
      shouldBypassPricing: true,
    }).status === "BYPASSED",
  );
  check(
    "An unclassified session is never matched",
    matchCatalogue({
      assetType: null,
      squareFeet: 9,
      dimensionSource: "CUSTOMER_MEASURED",
      shouldBypassPricing: false,
    }).status === "NO_MATCH",
  );

  const repeatedRuns = Array.from({ length: 5 }, () =>
    JSON.stringify(
      matchCatalogue({
        assetType: "RESIDENTIAL_WINDOW",
        squareFeet: 11.3,
        dimensionSource: "CUSTOMER_CONFIRMED",
        shouldBypassPricing: false,
      }),
    ),
  );

  check(
    "The same opening always produces the same match",
    new Set(repeatedRuns).size === 1,
    "no model anywhere in the pricing path",
  );

  const catalogueNotes = renderNotes({
    ...notesHeader,
    catalogue: {
      snapshotExportedAt: catalogueSnapshotExportedAt().toISOString(),
      matches: residentialMatch.matches.map((match) => ({
        serviceName: match.serviceName,
        matchConfidence: match.matchConfidence,
        isBaseItem: match.isBaseItem,
      })),
    },
  });

  check(
    "The reviewer is told which price book items were proposed",
    catalogueNotes.includes("PRICE BOOK MATCH"),
  );
  check(
    "The notes date the catalogue the match came from",
    catalogueNotes.includes(
      catalogueSnapshotExportedAt().toISOString().slice(0, 10),
    ),
  );
  check(
    "The match block still states no price",
    !/\$\d/.test(
      catalogueNotes.slice(
        catalogueNotes.indexOf("PRICE BOOK MATCH"),
        catalogueNotes.indexOf("SAFETY GLAZING"),
      ),
    ),
  );

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`,
  );

  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Verification crashed:", error);
  process.exit(1);
});
