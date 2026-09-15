import { z } from "zod";

import catalogueExport from "@/catalogue-export.json";

const observedNameSchema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
});

const catalogueItemSchema = z.object({
  serviceItemId: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  squareFootageBand: z.number().positive().nullable(),
  timesSeen: z.number().int().nonnegative(),
  namesObserved: z.array(observedNameSchema),
});

export type CatalogueItem = z.infer<typeof catalogueItemSchema>;

const catalogueSnapshotSchema = z.object({
  exportedAt: z.string().min(1),
  allServiceItems: z.array(catalogueItemSchema),
  squareFootageBanded: z.array(catalogueItemSchema),
});

export type CatalogueSnapshot = z.infer<typeof catalogueSnapshotSchema>;

export const LABOUR_ITEM_KIND = "labor";

let cachedSnapshot: CatalogueSnapshot | null = null;

export function loadCatalogueSnapshot(): CatalogueSnapshot {
  cachedSnapshot ??= catalogueSnapshotSchema.parse(catalogueExport);
  return cachedSnapshot;
}

export function catalogueItemById(serviceItemId: string): CatalogueItem | null {
  return (
    loadCatalogueSnapshot().allServiceItems.find(
      (item) => item.serviceItemId === serviceItemId,
    ) ?? null
  );
}

export function catalogueSnapshotExportedAt(): Date {
  return new Date(loadCatalogueSnapshot().exportedAt);
}

export const CATALOGUE_SNAPSHOT_STALE_AFTER_DAYS = 90;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function catalogueSnapshotAgeInDays(now: Date = new Date()): number {
  const exportedAt = catalogueSnapshotExportedAt().getTime();
  return Math.floor((now.getTime() - exportedAt) / MILLISECONDS_PER_DAY);
}

export function catalogueSnapshotIsStale(now: Date = new Date()): boolean {
  return catalogueSnapshotAgeInDays(now) > CATALOGUE_SNAPSHOT_STALE_AFTER_DAYS;
}
