import { prisma } from "@/core/db/prisma";
import { readFromDatabase, type DatabaseRead } from "@/core/db/read-guard";
import type { EstimateStatus } from "@/generated/prisma/enums";

export interface EstimateQueueRow {
  id: string;
  status: EstimateStatus;
  housecallProEstimateId: string | null;
  customerName: string | null;
  serviceAddress: string | null;
  locationName: string | null;
  needsWorkByHand: boolean;
  syncAttempts: number;
  lastSyncError: string | null;
  isTestRecord: boolean;
  syncedAt: Date | null;
  createdAt: Date;
}

const ESTIMATE_PAGE_SIZE = 50;

export function listEstimateQueue(): Promise<DatabaseRead<EstimateQueueRow[]>> {
  return readFromDatabase("listEstimateQueue", async () => {
    const estimates = await prisma.estimate.findMany({
      orderBy: { createdAt: "desc" },
      take: ESTIMATE_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        housecallProEstimateId: true,
        syncAttempts: true,
        lastSyncError: true,
        isTestRecord: true,
        syncedAt: true,
        createdAt: true,
        session: {
          select: {
            customerName: true,
            serviceAddress: true,
            franchiseLocation: { select: { name: true } },
            catalogueMatches: {
              where: { needsReviewerCompletion: true },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    return estimates.map((estimate) => ({
      id: estimate.id,
      status: estimate.status,
      housecallProEstimateId: estimate.housecallProEstimateId,
      customerName: estimate.session.customerName,
      serviceAddress: estimate.session.serviceAddress,
      locationName: estimate.session.franchiseLocation?.name ?? null,
      needsWorkByHand: estimate.session.catalogueMatches.length > 0,
      syncAttempts: estimate.syncAttempts,
      lastSyncError: estimate.lastSyncError,
      isTestRecord: estimate.isTestRecord,
      syncedAt: estimate.syncedAt,
      createdAt: estimate.createdAt,
    }));
  });
}
