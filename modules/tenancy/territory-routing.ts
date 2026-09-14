import { prisma } from "@/core/db/prisma";
import {
  parseTerritoryDefinition,
  type GeoBoundary,
} from "@/modules/tenancy/schemas";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RoutableLocation {
  id: string;
  name: string;
  slug: string;
  priceBookId: string | null;
  housecallProAccountId: string | null;
  hasApiKey: boolean;
}

export type TerritoryRoutingResult =
  | { outcome: "ROUTED"; location: RoutableLocation }
  | {
      outcome: "ROUTED_BY_SOLE_LOCATION";
      location: RoutableLocation;
      zipCode: string | null;
    }
  | { outcome: "NO_ZIP_IN_ADDRESS" }
  | { outcome: "NO_TERRITORY_MATCH"; zipCode: string }
  | {
      outcome: "AMBIGUOUS_TERRITORY";
      zipCode: string;
      candidates: RoutableLocation[];
    };

export function routedLocationOf(
  result: TerritoryRoutingResult,
): RoutableLocation | null {
  return result.outcome === "ROUTED" ||
    result.outcome === "ROUTED_BY_SOLE_LOCATION"
    ? result.location
    : null;
}

const ZIP_IN_ADDRESS_PATTERN = /\b(\d{5})(?:-\d{4})?\b/g;

export function extractZipCode(address: string): string | null {
  const matches = [...address.matchAll(ZIP_IN_ADDRESS_PATTERN)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1];
}

export function isPointInsideBoundary(
  point: Coordinates,
  boundary: GeoBoundary,
): boolean {
  if (!boundary) return false;

  const outerRing = boundary.coordinates[0];
  if (!outerRing || outerRing.length < 4) return false;

  let inside = false;
  for (
    let current = 0, previous = outerRing.length - 1;
    current < outerRing.length;
    previous = current, current += 1
  ) {
    const [currentLongitude, currentLatitude] = outerRing[current];
    const [previousLongitude, previousLatitude] = outerRing[previous];

    const straddlesLatitude =
      currentLatitude > point.latitude !== previousLatitude > point.latitude;

    if (!straddlesLatitude) continue;

    const longitudeAtLatitude =
      previousLongitude +
      ((point.latitude - currentLatitude) *
        (previousLongitude - currentLongitude)) /
        (previousLatitude - currentLatitude);

    if (point.longitude < longitudeAtLatitude) {
      inside = !inside;
    }
  }

  return inside;
}

export async function resolveFranchiseLocation({
  serviceAddress,
  coordinates,
}: {
  serviceAddress: string;
  coordinates?: Coordinates;
}): Promise<TerritoryRoutingResult> {
  const zipCode = extractZipCode(serviceAddress);

  const locations = await prisma.franchiseLocation.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      priceBookId: true,
      housecallProAccountId: true,
      apiKeyEncrypted: true,
      territoryDefinition: true,
    },
    orderBy: { name: "asc" },
  });

  const toRoutable = (
    location: (typeof locations)[number],
  ): RoutableLocation => ({
    id: location.id,
    name: location.name,
    slug: location.slug,
    priceBookId: location.priceBookId,
    housecallProAccountId: location.housecallProAccountId,
    hasApiKey: location.apiKeyEncrypted !== null,
  });

  const soleLocation = locations.length === 1 ? locations[0] : null;

  if (!zipCode) {
    return soleLocation
      ? {
          outcome: "ROUTED_BY_SOLE_LOCATION",
          location: toRoutable(soleLocation),
          zipCode: null,
        }
      : { outcome: "NO_ZIP_IN_ADDRESS" };
  }

  const matches = locations.filter((location) => {
    const territory = parseTerritoryDefinition(location.territoryDefinition);

    if (territory.zipCodes.includes(zipCode)) return true;

    return coordinates
      ? isPointInsideBoundary(coordinates, territory.geoBoundary)
      : false;
  });

  const candidates: RoutableLocation[] = matches.map(toRoutable);

  if (candidates.length === 0) {
    return soleLocation
      ? {
          outcome: "ROUTED_BY_SOLE_LOCATION",
          location: toRoutable(soleLocation),
          zipCode,
        }
      : { outcome: "NO_TERRITORY_MATCH", zipCode };
  }

  if (candidates.length > 1) {
    return { outcome: "AMBIGUOUS_TERRITORY", zipCode, candidates };
  }

  return { outcome: "ROUTED", location: candidates[0] };
}

export function describeRoutingResult(result: TerritoryRoutingResult): string {
  switch (result.outcome) {
    case "ROUTED":
      return `Routed to ${result.location.name}`;
    case "ROUTED_BY_SOLE_LOCATION":
      return `Routed to ${result.location.name}, the only active location${
        result.zipCode
          ? `, though ZIP ${result.zipCode} is outside its territory`
          : ", though the address carried no ZIP code"
      }`;
    case "NO_ZIP_IN_ADDRESS":
      return "No ZIP code found in the service address";
    case "NO_TERRITORY_MATCH":
      return `ZIP ${result.zipCode} is outside every active territory`;
    case "AMBIGUOUS_TERRITORY":
      return `ZIP ${result.zipCode} is claimed by ${result.candidates.length} locations`;
  }
}
