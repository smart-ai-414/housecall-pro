import { prisma } from "@/core/db/prisma";
import { readFromDatabase, type DatabaseRead } from "@/core/db/read-guard";
import {
  parseTerritoryDefinition,
  type TerritoryDefinition,
} from "@/modules/tenancy/schemas";

export interface FranchiseLocationRow {
  id: string;
  name: string;
  slug: string;
  territory: TerritoryDefinition;
  housecallProAccountId: string | null;
  priceBookId: string | null;
  hasApiKey: boolean;
  isActive: boolean;
  sessionCount: number;
}

export function listFranchiseLocations(): Promise<
  DatabaseRead<FranchiseLocationRow[]>
> {
  return readFromDatabase("listFranchiseLocations", async () => {
    const locations = await prisma.franchiseLocation.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        territoryDefinition: true,
        housecallProAccountId: true,
        priceBookId: true,
        apiKeyEncrypted: true,
        isActive: true,
        _count: { select: { customerSessions: true } },
      },
    });

    return locations.map((location) => ({
      id: location.id,
      name: location.name,
      slug: location.slug,
      territory: parseTerritoryDefinition(location.territoryDefinition),
      housecallProAccountId: location.housecallProAccountId,
      priceBookId: location.priceBookId,
      hasApiKey: location.apiKeyEncrypted !== null,
      isActive: location.isActive,
      sessionCount: location._count.customerSessions,
    }));
  });
}

export function findOverlappingZipCodes(
  locations: readonly FranchiseLocationRow[],
): string[] {
  const seen = new Map<string, number>();

  for (const location of locations) {
    if (!location.isActive) continue;
    for (const zipCode of location.territory.zipCodes) {
      seen.set(zipCode, (seen.get(zipCode) ?? 0) + 1);
    }
  }

  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([zipCode]) => zipCode)
    .sort();
}
