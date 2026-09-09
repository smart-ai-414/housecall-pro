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
  extractZipCode,
  isPointInsideBoundary,
} from "../modules/tenancy/territory-routing";

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

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`,
  );

  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Verification crashed:", error);
  process.exit(1);
});
