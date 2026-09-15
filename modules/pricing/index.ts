export {
  matchCatalogue,
  isNearBandBoundary,
  type CatalogueMatchInput,
  type CatalogueMatchPlan,
  type CatalogueMatchStatus,
  type DimensionSource,
  type ProposedCatalogueMatch,
} from "@/modules/pricing/catalogue-matcher";
export {
  ensureCatalogueMatches,
  type CatalogueMatchOutcome,
} from "@/modules/pricing/pricing-service";
export {
  describeFamily,
  familyOf,
  ladderFor,
  MINIMUM_SIGHTINGS_TO_MATCH,
  SERVICE_FAMILIES,
  type LadderRung,
  type ServiceFamily,
} from "@/modules/pricing/catalogue-families";
export {
  ASSET_PRICING_RULES,
  SERVICE_CALL_SERVICE_ITEM_ID,
} from "@/modules/pricing/matching-rules";
export {
  catalogueSnapshotExportedAt,
  catalogueSnapshotIsStale,
  loadCatalogueSnapshot,
} from "@/modules/pricing/catalogue-snapshot";
