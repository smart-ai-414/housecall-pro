import { z } from "zod";

const ENCRYPTION_KEY_BYTES = 32;

class EnvironmentError extends Error {
  constructor(group: string, issues: string[]) {
    super(
      `Invalid ${group} environment configuration:\n` +
        issues.map((issue) => `  - ${issue}`).join("\n") +
        `\n\nSee .env.example for the expected values.`,
    );
    this.name = "EnvironmentError";
  }
}

function parseGroup<T extends z.ZodType>(
  group: string,
  schema: T,
): z.output<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new EnvironmentError(
      group,
      result.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    );
  }
  return result.data;
}

function memoizedPerProcess<T>(load: () => T): () => T {
  let cached: T | undefined;
  return () => (cached ??= load());
}

const coreSchema = z.object({
  DATABASE_URL: z.string().min(1, "required"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const coreEnv = memoizedPerProcess(() => parseGroup("core", coreSchema));

export const isProduction = () => process.env.NODE_ENV === "production";

const base64EncodedKeyOfExactly32Bytes = z
  .string()
  .min(1, "required")
  .refine(
    (value) => Buffer.from(value, "base64").length === ENCRYPTION_KEY_BYTES,
    {
      message:
        "must decode to exactly 32 bytes, base64-encoded (generate with: openssl rand -base64 32)",
    },
  );

const secretsSchema = z.object({
  ENCRYPTION_KEY: base64EncodedKeyOfExactly32Bytes,
  RESUME_TOKEN_SECRET: z
    .string()
    .min(32, "must be at least 32 characters (openssl rand -base64 32)"),
});

export const secretsEnv = memoizedPerProcess(() =>
  parseGroup("secrets", secretsSchema),
);

const rateLimitSchema = z.object({
  RATE_LIMIT_SESSIONS_PER_DAY: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_MIN_SECONDS_BETWEEN_SESSIONS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(30),
});

export const rateLimitEnv = memoizedPerProcess(() =>
  parseGroup("rate limit", rateLimitSchema),
);

const storageSchema = z.object({
  STORAGE_BUCKET: z.string().min(1, "required"),
  STORAGE_REGION: z.string().min(1, "required"),
  STORAGE_ACCESS_KEY_ID: z.string().min(1, "required"),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1, "required"),
  STORAGE_ENDPOINT: z.string().url().optional().or(z.literal("")),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional().or(z.literal("")),
});

export const storageEnv = memoizedPerProcess(() =>
  parseGroup("storage", storageSchema),
);

export function isStorageConfigured(): boolean {
  return storageSchema.safeParse(process.env).success;
}

const housecallProSchema = z.object({
  HOUSECALL_PRO_API_BASE_URL: z
    .string()
    .url()
    .default("https://api.housecallpro.com"),
});

export const housecallProEnv = memoizedPerProcess(() =>
  parseGroup("Housecall Pro", housecallProSchema),
);

const anthropicSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "required"),
});

export const anthropicEnv = memoizedPerProcess(() =>
  parseGroup("Anthropic", anthropicSchema),
);

export function isAnthropicConfigured(): boolean {
  return anthropicSchema.safeParse(process.env).success;
}
