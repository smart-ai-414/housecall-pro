import { z } from "zod";

import { PhotoType } from "@/generated/prisma/enums";
import { MAX_MESSAGE_LENGTH } from "@/modules/intake/conversation-state";
import { ACCEPTED_UPLOAD_CONTENT_TYPES } from "@/modules/photos/image-processing";
import { BOT_HONEYPOT_FIELD_NAME } from "@/core/security/request-guard";

export const photoTypeSchema = z.enum(
  Object.values(PhotoType) as [string, ...string[]],
);

export const startSessionSchema = z.object({
  [BOT_HONEYPOT_FIELD_NAME]: z.string().optional(),
  clientRenderedAt: z.number().int().optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export const customerMessageSchema = z.object({
  sessionId: z.uuid(),
  resumeToken: z.string().min(16),
  message: z
    .string()
    .trim()
    .min(1, "Type a message first")
    .max(MAX_MESSAGE_LENGTH, "That message is too long"),
});

export const contactDetailsSchema = z.object({
  sessionId: z.uuid(),
  resumeToken: z.string().min(16),
  name: z.string().trim().min(1, "A name is required").max(120),
  phone: z
    .string()
    .trim()
    .min(7, "A phone number is required")
    .max(32)
    .regex(/^[\d\s()+\-.]+$/, "Use digits only"),
  email: z
    .string()
    .trim()
    .max(200)
    .transform((value) => (value.length === 0 ? null : value.toLowerCase()))
    .nullable()
    .refine(
      (value) => value === null || z.email().safeParse(value).success,
      "Enter a valid email address",
    ),
  serviceAddress: z
    .string()
    .trim()
    .min(8, "A full service address is required")
    .max(300),
});

export const photoUploadUrlSchema = z.object({
  sessionId: z.uuid(),
  resumeToken: z.string().min(16),
  photoType: z.enum(Object.values(PhotoType) as [PhotoType, ...PhotoType[]]),
  contentType: z.enum(
    ACCEPTED_UPLOAD_CONTENT_TYPES as unknown as [string, ...string[]],
  ),
  byteSize: z.number().int().positive(),
});

export const photoConfirmSchema = z.object({
  sessionId: z.uuid(),
  resumeToken: z.string().min(16),
  photoType: z.enum(Object.values(PhotoType) as [PhotoType, ...PhotoType[]]),
  storageKey: z.string().min(8).max(400),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type CustomerMessageInput = z.infer<typeof customerMessageSchema>;
export type ContactDetailsInput = z.infer<typeof contactDetailsSchema>;
export type PhotoUploadUrlInput = z.infer<typeof photoUploadUrlSchema>;
export type PhotoConfirmInput = z.infer<typeof photoConfirmSchema>;
