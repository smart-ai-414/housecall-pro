import { prisma } from "@/core/db/prisma";
import { AppError } from "@/core/errors";
import { decryptSecret } from "@/core/security/encryption";
import {
  createHousecallProClient,
  type HousecallProClient,
} from "@/modules/housecall-pro/client";

export interface LocationApiContext {
  client: HousecallProClient;
  locationId: string;
  locationName: string;
  priceBookId: string | null;
}

export async function createClientForLocation(
  locationId: string,
): Promise<LocationApiContext> {
  const location = await prisma.franchiseLocation.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      name: true,
      isActive: true,
      apiKeyEncrypted: true,
      priceBookId: true,
    },
  });

  if (!location) {
    throw new AppError("NOT_FOUND", "That franchise location does not exist.");
  }

  if (!location.isActive) {
    throw new AppError(
      "CONFLICT",
      `${location.name} is inactive, so nothing should be written to its Housecall Pro account.`,
    );
  }

  if (!location.apiKeyEncrypted) {
    throw new AppError(
      "CONFIGURATION_ERROR",
      `${location.name} has no Housecall Pro API key. Add one under Settings before syncing.`,
    );
  }

  return {
    client: createHousecallProClient(decryptSecret(location.apiKeyEncrypted)),
    locationId: location.id,
    locationName: location.name,
    priceBookId: location.priceBookId,
  };
}
