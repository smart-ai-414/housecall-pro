import type { AssetType } from "@/modules/perception/schemas";
import {
  describeFamily,
  ladderFor,
  type LadderRung,
} from "@/modules/pricing/catalogue-families";
import { catalogueItemById } from "@/modules/pricing/catalogue-snapshot";
import {
  ASSET_PRICING_RULES,
  BAND_BOUNDARY_PENALTY,
  BAND_BOUNDARY_TOLERANCE,
  MATCH_CONFIDENCE_BASE,
  SERVICE_CALL_MATCH_CONFIDENCE,
  SERVICE_CALL_SERVICE_ITEM_ID,
  UNCONFIRMED_DIMENSION_PENALTY,
} from "@/modules/pricing/matching-rules";

export const DIMENSION_SOURCES = [
  "CUSTOMER_MEASURED",
  "CUSTOMER_CONFIRMED",
  "UNCONFIRMED",
] as const;

export type DimensionSource = (typeof DIMENSION_SOURCES)[number];

export interface CatalogueMatchInput {
  assetType: AssetType | null;
  squareFeet: number | null;
  dimensionSource: DimensionSource;
  shouldBypassPricing: boolean;
}

export interface ProposedCatalogueMatch {
  housecallProServiceId: string;
  serviceName: string;
  quantity: number;
  isBaseItem: boolean;
  isAdditionalOpening: boolean;
  openingIndex: number | null;
  matchConfidence: number;
  needsReviewerCompletion: boolean;
}

export type CatalogueMatchStatus = "MATCHED" | "BYPASSED" | "NO_MATCH";

export interface CatalogueMatchPlan {
  status: CatalogueMatchStatus;
  matches: ProposedCatalogueMatch[];
  reasons: string[];
}

const PRIMARY_OPENING_INDEX = 1;

function noMatch(...reasons: string[]): CatalogueMatchPlan {
  return { status: "NO_MATCH", matches: [], reasons };
}

function selectRung(
  ladder: readonly LadderRung[],
  squareFeet: number,
): { rung: LadderRung; lowerBoundary: number } | null {
  const index = ladder.findIndex(
    (candidate) => squareFeet <= candidate.maximumSquareFeet,
  );

  if (index === -1) return null;

  return {
    rung: ladder[index],
    lowerBoundary: index === 0 ? 0 : ladder[index - 1].maximumSquareFeet,
  };
}

export function isNearBandBoundary({
  squareFeet,
  lowerBoundary,
  upperBoundary,
}: {
  squareFeet: number;
  lowerBoundary: number;
  upperBoundary: number;
}): boolean {
  const headroom = upperBoundary - squareFeet;
  const footroom = squareFeet - lowerBoundary;

  return Math.min(headroom, footroom) / squareFeet < BAND_BOUNDARY_TOLERANCE;
}

export function matchCatalogue(input: CatalogueMatchInput): CatalogueMatchPlan {
  if (input.shouldBypassPricing) {
    return {
      status: "BYPASSED",
      matches: [],
      reasons: [
        "Pricing was bypassed upstream, so no catalogue matching was attempted.",
      ],
    };
  }

  if (input.assetType === null) {
    return noMatch(
      "Nothing was classified, so there was nothing to match against the price book.",
    );
  }

  const rule = ASSET_PRICING_RULES[input.assetType];

  if (!rule.isBandMatchable || rule.family === null) {
    return noMatch(
      rule.reasonNotMatchable ??
        "This kind of work is not matched to the price book automatically.",
    );
  }

  if (input.squareFeet === null || input.squareFeet <= 0) {
    return noMatch(
      "No opening size was captured, so no size band could be selected.",
    );
  }

  const ladder = ladderFor(rule.family);

  if (ladder.length === 0) {
    return noMatch(
      `The catalogue snapshot carries no banded ${describeFamily(rule.family)} item, so no band could be selected.`,
    );
  }

  const selected = selectRung(ladder, input.squareFeet);

  if (selected === null) {
    const largest = ladder[ladder.length - 1];

    return noMatch(
      `The opening measures about ${input.squareFeet.toFixed(1)} sq ft, beyond the largest ${describeFamily(rule.family)} band in the price book (${largest.maximumSquareFeet} sq ft). Quote this one by hand rather than forcing it into the top band.`,
    );
  }

  const { rung, lowerBoundary } = selected;

  const reasons: string[] = [];

  let confidence = MATCH_CONFIDENCE_BASE;

  if (input.dimensionSource === "UNCONFIRMED") {
    confidence -= UNCONFIRMED_DIMENSION_PENALTY;
    reasons.push(
      "The size band was chosen from a measurement the customer never confirmed. Check the band before sending.",
    );
  }

  if (
    input.dimensionSource !== "CUSTOMER_MEASURED" &&
    isNearBandBoundary({
      squareFeet: input.squareFeet,
      lowerBoundary,
      upperBoundary: rung.maximumSquareFeet,
    })
  ) {
    confidence -= BAND_BOUNDARY_PENALTY;
    reasons.push(
      `About ${input.squareFeet.toFixed(1)} sq ft sits within ${Math.round(BAND_BOUNDARY_TOLERANCE * 100)}% of the edge of the ${rung.maximumSquareFeet} sq ft band. A small measuring error moves it to the neighbouring band, so confirm the size before sending.`,
    );
  }

  const matches: ProposedCatalogueMatch[] = [];

  const serviceCall = catalogueItemById(SERVICE_CALL_SERVICE_ITEM_ID);

  if (serviceCall === null) {
    reasons.push(
      "The service call item is missing from the catalogue snapshot, so only the glass line was proposed. Re-run npm run hcp:catalogue.",
    );
  } else {
    matches.push({
      housecallProServiceId: serviceCall.serviceItemId,
      serviceName: serviceCall.name,
      quantity: 1,
      isBaseItem: true,
      isAdditionalOpening: false,
      openingIndex: null,
      matchConfidence: SERVICE_CALL_MATCH_CONFIDENCE,
      needsReviewerCompletion: false,
    });
  }

  matches.push({
    housecallProServiceId: rung.serviceItemId,
    serviceName: rung.serviceName,
    quantity: 1,
    isBaseItem: false,
    isAdditionalOpening: false,
    openingIndex: PRIMARY_OPENING_INDEX,
    matchConfidence: Math.max(0, Math.min(1, confidence)),
    needsReviewerCompletion: false,
  });

  return { status: "MATCHED", matches, reasons };
}
