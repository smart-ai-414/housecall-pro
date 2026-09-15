import {
  LABOUR_ITEM_KIND,
  loadCatalogueSnapshot,
  type CatalogueItem,
} from "@/modules/pricing/catalogue-snapshot";

export const SERVICE_FAMILIES = [
  "RESIDENTIAL",
  "SLIDING_DOOR",
  "COMMERCIAL_STOREFRONT",
] as const;

export type ServiceFamily = (typeof SERVICE_FAMILIES)[number];

const FAMILY_NAME_EVIDENCE: Record<ServiceFamily, RegExp> = {
  RESIDENTIAL: /residential/i,
  SLIDING_DOOR: /sliding\s*door/i,
  COMMERCIAL_STOREFRONT: /storefront|commercial/i,
};

export const MINIMUM_SIGHTINGS_TO_MATCH = 2;

export type FamilyEvidence = Record<ServiceFamily, number>;

export function familyEvidenceFor(item: CatalogueItem): FamilyEvidence {
  const evidence: FamilyEvidence = {
    RESIDENTIAL: 0,
    SLIDING_DOOR: 0,
    COMMERCIAL_STOREFRONT: 0,
  };

  for (const observed of item.namesObserved) {
    for (const family of SERVICE_FAMILIES) {
      if (FAMILY_NAME_EVIDENCE[family].test(observed.name)) {
        evidence[family] += observed.count;
      }
    }
  }

  return evidence;
}

export function familyOf(item: CatalogueItem): ServiceFamily | null {
  const evidence = familyEvidenceFor(item);

  const ranked = SERVICE_FAMILIES.map((family) => ({
    family,
    weight: evidence[family],
  }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0].weight === ranked[1].weight) return null;

  return ranked[0].family;
}

export interface LadderRung {
  serviceItemId: string;
  serviceName: string;
  maximumSquareFeet: number;
  timesSeen: number;
}

interface BandCandidate {
  family: ServiceFamily;
  rung: LadderRung;
}

function candidateFor(item: CatalogueItem): BandCandidate | null {
  if (item.kind !== LABOUR_ITEM_KIND) return null;
  if (item.timesSeen < MINIMUM_SIGHTINGS_TO_MATCH) return null;

  const band = item.squareFootageBand;
  if (band === null) return null;

  const family = familyOf(item);
  if (family === null) return null;

  return {
    family,
    rung: {
      serviceItemId: item.serviceItemId,
      serviceName: item.name,
      maximumSquareFeet: band,
      timesSeen: item.timesSeen,
    },
  };
}

function outranks(challenger: LadderRung, incumbent: LadderRung): boolean {
  if (challenger.timesSeen !== incumbent.timesSeen) {
    return challenger.timesSeen > incumbent.timesSeen;
  }

  return challenger.serviceItemId < incumbent.serviceItemId;
}

function buildLadders(): Record<ServiceFamily, LadderRung[]> {
  const bestPerBand = new Map<string, BandCandidate>();

  for (const item of loadCatalogueSnapshot().squareFootageBanded) {
    const candidate = candidateFor(item);
    if (candidate === null) continue;

    const key = `${candidate.family}:${candidate.rung.maximumSquareFeet}`;
    const incumbent = bestPerBand.get(key);

    if (incumbent === undefined || outranks(candidate.rung, incumbent.rung)) {
      bestPerBand.set(key, candidate);
    }
  }

  const ladders: Record<ServiceFamily, LadderRung[]> = {
    RESIDENTIAL: [],
    SLIDING_DOOR: [],
    COMMERCIAL_STOREFRONT: [],
  };

  for (const candidate of bestPerBand.values()) {
    ladders[candidate.family].push(candidate.rung);
  }

  for (const family of SERVICE_FAMILIES) {
    ladders[family].sort((a, b) => a.maximumSquareFeet - b.maximumSquareFeet);
  }

  return ladders;
}

let cachedLadders: Record<ServiceFamily, LadderRung[]> | null = null;

export function ladderFor(family: ServiceFamily): readonly LadderRung[] {
  cachedLadders ??= buildLadders();
  return cachedLadders[family];
}

export function describeFamily(family: ServiceFamily): string {
  switch (family) {
    case "RESIDENTIAL":
      return "residential";
    case "SLIDING_DOOR":
      return "sliding door";
    case "COMMERCIAL_STOREFRONT":
      return "commercial storefront";
  }
}
