import { prisma } from "@/core/db/prisma";
import { readFromDatabase, type DatabaseRead } from "@/core/db/read-guard";
import type { EstimateStatus } from "@/generated/prisma/enums";

export interface EstimateObservation {
  assetType: string;
  issueType: string;
  confidenceScore: number;
  isLowConfidence: boolean;
  photoQualityAssessment: string | null;
  widthInches: number | null;
  heightInches: number | null;
  customerConfirmedDimensions: boolean;
}

export interface EstimateQueueRow {
  id: string;
  status: EstimateStatus;
  housecallProEstimateId: string | null;
  customerName: string | null;
  serviceAddress: string | null;
  locationName: string | null;
  needsWorkByHand: boolean;
  pricingBypassed: boolean;
  observation: EstimateObservation | null;
  reviewerEditCount: number;
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
        _count: { select: { reviewerEdits: true } },
        session: {
          select: {
            customerName: true,
            serviceAddress: true,
            shouldBypassPricing: true,
            franchiseLocation: { select: { name: true } },
            catalogueMatches: {
              where: { needsReviewerCompletion: true },
              select: { id: true },
              take: 1,
            },
            classifications: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                assetType: true,
                issueType: true,
                confidenceScore: true,
                isLowConfidence: true,
                photoQualityAssessment: true,
              },
            },
            dimensionEstimates: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                widthInches: true,
                heightInches: true,
                customerConfirmed: true,
                customerCorrectedWidth: true,
                customerCorrectedHeight: true,
              },
            },
          },
        },
      },
    });

    return estimates.map((estimate) => {
      const classification = estimate.session.classifications[0] ?? null;
      const dimensions = estimate.session.dimensionEstimates[0] ?? null;

      return {
        id: estimate.id,
        status: estimate.status,
        housecallProEstimateId: estimate.housecallProEstimateId,
        customerName: estimate.session.customerName,
        serviceAddress: estimate.session.serviceAddress,
        locationName: estimate.session.franchiseLocation?.name ?? null,
        needsWorkByHand: estimate.session.catalogueMatches.length > 0,
        pricingBypassed: estimate.session.shouldBypassPricing,
        observation: classification
          ? {
              assetType: classification.assetType,
              issueType: classification.issueType,
              confidenceScore: classification.confidenceScore,
              isLowConfidence: classification.isLowConfidence,
              photoQualityAssessment: classification.photoQualityAssessment,
              widthInches:
                dimensions?.customerCorrectedWidth ??
                dimensions?.widthInches ??
                null,
              heightInches:
                dimensions?.customerCorrectedHeight ??
                dimensions?.heightInches ??
                null,
              customerConfirmedDimensions:
                dimensions?.customerConfirmed ?? false,
            }
          : null,
        reviewerEditCount: estimate._count.reviewerEdits,
        syncAttempts: estimate.syncAttempts,
        lastSyncError: estimate.lastSyncError,
        isTestRecord: estimate.isTestRecord,
        syncedAt: estimate.syncedAt,
        createdAt: estimate.createdAt,
      };
    });
  });
}
