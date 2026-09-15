import type { AssetType } from "@/modules/perception/schemas";
import type { ServiceFamily } from "@/modules/pricing/catalogue-families";

export interface AssetPricingRule {
  family: ServiceFamily | null;
  isBandMatchable: boolean;
  reasonNotMatchable: string | null;
}

export const ASSET_PRICING_RULES: Record<AssetType, AssetPricingRule> = {
  RESIDENTIAL_WINDOW: {
    family: "RESIDENTIAL",
    isBandMatchable: true,
    reasonNotMatchable: null,
  },
  SLIDING_DOOR: {
    family: "SLIDING_DOOR",
    isBandMatchable: true,
    reasonNotMatchable: null,
  },
  COMMERCIAL_STOREFRONT: {
    family: "COMMERCIAL_STOREFRONT",
    isBandMatchable: false,
    reasonNotMatchable:
      "Commercial storefront bands sit as little as 1.4% apart on each axis. No measurement taken from a photograph can resolve that, so this one is measured on site and banded by hand.",
  },
  SHOWER_GLASS: {
    family: null,
    isBandMatchable: false,
    reasonNotMatchable:
      "Shower glass is priced by configuration, not by square footage. Pick the shower item that matches the layout.",
  },
  DOOR_GLASS: {
    family: null,
    isBandMatchable: false,
    reasonNotMatchable:
      "Door glass has no banded ladder in the price book. Pick the door item by hand.",
  },
  MIRROR: {
    family: null,
    isBandMatchable: false,
    reasonNotMatchable:
      "Mirrors are supplied and installed to size, with no banded ladder. Pick the mirror item by hand.",
  },
  UNKNOWN: {
    family: null,
    isBandMatchable: false,
    reasonNotMatchable:
      "The assistant could not tell what kind of opening this is, so nothing was matched to the price book.",
  },
};

export const SERVICE_CALL_SERVICE_ITEM_ID =
  "olit_8ab0a7223e024f548a9c651fdf96d8ba";

export const BAND_BOUNDARY_TOLERANCE = 0.05;

export const MATCH_CONFIDENCE_BASE = 0.9;

export const UNCONFIRMED_DIMENSION_PENALTY = 0.25;

export const BAND_BOUNDARY_PENALTY = 0.3;

export const SERVICE_CALL_MATCH_CONFIDENCE = 0.95;
