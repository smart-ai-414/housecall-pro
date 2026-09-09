import convertHeic from "heic-convert";
import sharp from "sharp";

export type SupportedImageFormat = "jpeg" | "png" | "webp" | "heic" | "avif";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_PIXEL_COUNT = 80_000_000;
export const MAX_EDGE_PIXELS = 20_000;
export const PROCESSED_MAX_EDGE = 2048;
export const PROCESSED_JPEG_QUALITY = 82;
export const PROCESSED_CONTENT_TYPE = "image/jpeg";

const MAGIC_BYTE_SNIFF_LENGTH = 4096;

export const ACCEPTED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
] as const;

export type ImageRejectionReason =
  | "EMPTY_FILE"
  | "TOO_LARGE"
  | "UNRECOGNISED_FORMAT"
  | "DIMENSIONS_UNREADABLE"
  | "DIMENSIONS_TOO_LARGE"
  | "DECODE_FAILED";

export class ImageRejectedError extends Error {
  readonly reason: ImageRejectionReason;

  constructor(reason: ImageRejectionReason, message: string) {
    super(message);
    this.name = "ImageRejectedError";
    this.reason = reason;
  }
}

export interface ImageHeaderInfo {
  format: SupportedImageFormat;
  width: number;
  height: number;
}

export interface ProcessedPhoto {
  buffer: Buffer;
  contentType: typeof PROCESSED_CONTENT_TYPE;
  byteSize: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalFormat: SupportedImageFormat;
  isHeicConverted: boolean;
  exifOrientationApplied: boolean;
  metadataStripped: boolean;
}

function startsWith(buffer: Buffer, bytes: readonly number[], offset = 0) {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

export function detectImageFormat(buffer: Buffer): SupportedImageFormat | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpeg";

  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }

  if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = buffer.subarray(8, 12).toString("latin1");
    if (brand === "avif" || brand === "avis") return "avif";
    if (HEIF_BRANDS.has(brand)) return "heic";
  }

  return null;
}

function readPngDimensions(buffer: Buffer): ImageHeaderInfo | null {
  if (buffer.length < 24) return null;
  if (buffer.subarray(12, 16).toString("latin1") !== "IHDR") return null;

  return {
    format: "png",
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readJpegDimensions(buffer: Buffer): ImageHeaderInfo | null {
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];

    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      return {
        format: "jpeg",
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }

  return null;
}

function readWebpDimensions(buffer: Buffer): ImageHeaderInfo | null {
  if (buffer.length < 30) return null;

  const chunk = buffer.subarray(12, 16).toString("latin1");

  if (chunk === "VP8 ") {
    return {
      format: "webp",
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return {
      format: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (chunk === "VP8X") {
    return {
      format: "webp",
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }

  return null;
}

const ISPE_BOX_MARKER = Buffer.from("ispe", "latin1");
const ISPE_WIDTH_OFFSET = 8;
const ISPE_HEIGHT_OFFSET = 12;
const ISPE_BOX_TAIL = 16;

function readIsoBmffDimensions(
  buffer: Buffer,
  format: SupportedImageFormat,
): ImageHeaderInfo | null {
  let largest: ImageHeaderInfo | null = null;
  let searchFrom = 0;

  while (searchFrom < buffer.length) {
    const at = buffer.indexOf(ISPE_BOX_MARKER, searchFrom);
    if (at === -1 || at + ISPE_BOX_TAIL > buffer.length) break;

    const candidate: ImageHeaderInfo = {
      format,
      width: buffer.readUInt32BE(at + ISPE_WIDTH_OFFSET),
      height: buffer.readUInt32BE(at + ISPE_HEIGHT_OFFSET),
    };

    const isLarger =
      largest === null ||
      candidate.width * candidate.height > largest.width * largest.height;

    if (isLarger) largest = candidate;

    searchFrom = at + ISPE_BOX_MARKER.length;
  }

  return largest;
}

export function readImageHeader(buffer: Buffer): ImageHeaderInfo {
  if (buffer.length === 0) {
    throw new ImageRejectedError("EMPTY_FILE", "That file was empty.");
  }

  const format = detectImageFormat(buffer);
  if (!format) {
    throw new ImageRejectedError(
      "UNRECOGNISED_FORMAT",
      "That does not look like a photo. Send a JPEG, PNG, WebP or a photo straight from your phone.",
    );
  }

  const header = (() => {
    switch (format) {
      case "jpeg":
        return readJpegDimensions(buffer);
      case "png":
        return readPngDimensions(buffer);
      case "webp":
        return readWebpDimensions(buffer);
      case "heic":
      case "avif":
        return readIsoBmffDimensions(buffer, format);
    }
  })();

  if (!header || header.width <= 0 || header.height <= 0) {
    throw new ImageRejectedError(
      "DIMENSIONS_UNREADABLE",
      "We could not read that image's size. Try sending it again, or take a fresh photo.",
    );
  }

  if (
    header.width > MAX_EDGE_PIXELS ||
    header.height > MAX_EDGE_PIXELS ||
    header.width * header.height > MAX_PIXEL_COUNT
  ) {
    throw new ImageRejectedError(
      "DIMENSIONS_TOO_LARGE",
      "That image is too large to process. Send a photo taken with your phone's normal camera.",
    );
  }

  return header;
}

export function assertUploadSizeWithinLimit(byteSize: number): void {
  if (byteSize <= 0) {
    throw new ImageRejectedError("EMPTY_FILE", "That file was empty.");
  }

  if (byteSize > MAX_UPLOAD_BYTES) {
    throw new ImageRejectedError(
      "TOO_LARGE",
      `That file is larger than ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
    );
  }
}

async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  const converted = await convertHeic({
    buffer: new Uint8Array(buffer),
    format: "JPEG",
    quality: 0.95,
  });

  return Buffer.from(converted);
}

export async function processPhotoForAnalysis(
  input: Buffer,
): Promise<ProcessedPhoto> {
  assertUploadSizeWithinLimit(input.byteLength);

  const header = readImageHeader(input.subarray(0, MAGIC_BYTE_SNIFF_LENGTH));

  const isHeicConverted = header.format === "heic";
  const decodable = isHeicConverted ? await convertHeicToJpeg(input) : input;

  try {
    const pipeline = sharp(decodable, {
      limitInputPixels: MAX_PIXEL_COUNT,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: PROCESSED_MAX_EDGE,
        height: PROCESSED_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: PROCESSED_JPEG_QUALITY, mozjpeg: true });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      contentType: PROCESSED_CONTENT_TYPE,
      byteSize: data.byteLength,
      width: info.width,
      height: info.height,
      originalWidth: header.width,
      originalHeight: header.height,
      originalFormat: header.format,
      isHeicConverted,
      exifOrientationApplied: true,
      metadataStripped: true,
    };
  } catch (error) {
    if (error instanceof ImageRejectedError) throw error;

    throw new ImageRejectedError(
      "DECODE_FAILED",
      "We could not read that image. Try taking the photo again.",
    );
  }
}
