import { z } from "zod";

export const ZIP_CODE_PATTERN = /^\d{5}$/;

export const geoBoundarySchema = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
  })
  .nullable();

export const territoryDefinitionSchema = z.object({
  zipCodes: z.array(z.string().regex(ZIP_CODE_PATTERN)),
  geoBoundary: geoBoundarySchema.default(null),
});

export type TerritoryDefinition = z.infer<typeof territoryDefinitionSchema>;
export type GeoBoundary = z.infer<typeof geoBoundarySchema>;

export const EMPTY_TERRITORY: TerritoryDefinition = {
  zipCodes: [],
  geoBoundary: null,
};

export function parseTerritoryDefinition(value: unknown): TerritoryDefinition {
  const parsed = territoryDefinitionSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_TERRITORY;
}

const zipCodeListSchema = z
  .string()
  .transform((raw) =>
    raw
      .split(/[\s,;]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  )
  .pipe(
    z.array(
      z.string().regex(ZIP_CODE_PATTERN, "Each ZIP code must be five digits"),
    ),
  )
  .transform((codes) => [...new Set(codes)].sort());

const slugSchema = z
  .string()
  .min(2, "Slug is required")
  .max(48)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens",
  );

export const franchiseLocationFormSchema = z.object({
  name: z.string().min(2, "Name is required").max(120).trim(),
  slug: slugSchema,
  zipCodes: zipCodeListSchema,
  housecallProAccountId: z
    .string()
    .max(120)
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  priceBookId: z
    .string()
    .max(120)
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  isActive: z.coerce.boolean(),
});

export type FranchiseLocationFormInput = z.infer<
  typeof franchiseLocationFormSchema
>;

export const locationApiKeySchema = z.object({
  locationId: z.uuid("Select a location"),
  apiKey: z
    .string()
    .min(8, "That does not look like an API key")
    .max(400)
    .trim(),
});
