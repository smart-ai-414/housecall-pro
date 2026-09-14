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
  OPENING_QUESTION_SEQUENCE,
  QUESTION_BANK,
  SAFETY_GLAZING_QUESTION_ID,
  safetyGlazingMayBeRequired,
} from "../modules/intake/question-bank";
import { buildLineItemsFromCatalogueMatches } from "../modules/housecall-pro/estimates";

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
  check(
    "Line items are emitted in a stable order",
    lineItems[0].order_index === 0 && lineItems[1].order_index === 1,
    "Housecall Pro discards order_index on create; this asserts our own output",
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
