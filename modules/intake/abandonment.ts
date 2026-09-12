import { prisma } from "@/core/db/prisma";
import type { SessionStatus } from "@/generated/prisma/enums";
import { syncSessionToHousecallPro } from "@/modules/estimates/estimate-sync-service";
import { recordSessionEvent } from "@/modules/intake/session-events";

export const ABANDONMENT_WINDOW_MINUTES = 240;
export const SWEEP_BATCH_SIZE = 25;

const OPEN_STATUSES: readonly SessionStatus[] = [
  "STARTED",
  "PHOTOS_RECEIVED",
  "CLASSIFYING",
  "QUESTIONING",
  "MATCHING",
  "NEEDS_CALLBACK",
];

export interface AbandonmentSweepResult {
  examined: number;
  markedAbandoned: number;
  syncedAsPartialLead: number;
  skippedNoContact: number;
  skippedNotRouted: number;
  failed: number;
}

export async function sweepAbandonedSessions(): Promise<AbandonmentSweepResult> {
  const cutoff = new Date(Date.now() - ABANDONMENT_WINDOW_MINUTES * 60 * 1000);

  const candidates = await prisma.customerSession.findMany({
    where: {
      status: { in: [...OPEN_STATUSES] },
      abandonedAt: null,
      OR: [
        { lastCustomerMessageAt: { lt: cutoff } },
        { lastCustomerMessageAt: null, createdAt: { lt: cutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH_SIZE,
    select: {
      id: true,
      customerPhone: true,
      customerEmail: true,
      franchiseLocationId: true,
    },
  });

  const result: AbandonmentSweepResult = {
    examined: candidates.length,
    markedAbandoned: 0,
    syncedAsPartialLead: 0,
    skippedNoContact: 0,
    skippedNotRouted: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    await prisma.customerSession.update({
      where: { id: candidate.id },
      data: { status: "ABANDONED", abandonedAt: new Date() },
    });
    result.markedAbandoned += 1;

    const hasContact =
      Boolean(candidate.customerPhone) || Boolean(candidate.customerEmail);

    await recordSessionEvent(candidate.id, "ABANDONED", {
      hasContact,
      routed: candidate.franchiseLocationId !== null,
      windowMinutes: ABANDONMENT_WINDOW_MINUTES,
    });

    if (!hasContact) {
      result.skippedNoContact += 1;
      continue;
    }

    if (!candidate.franchiseLocationId) {
      result.skippedNotRouted += 1;
      continue;
    }

    try {
      const outcome = await syncSessionToHousecallPro({
        sessionId: candidate.id,
        reason: "ABANDONED_PARTIAL_LEAD",
      });

      if (outcome.status === "SYNCED" || outcome.status === "ALREADY_SYNCED") {
        result.syncedAsPartialLead += 1;
      } else {
        result.failed += 1;
      }
    } catch (error) {
      console.error(
        `[abandonment] partial lead sync failed for ${candidate.id}`,
        error,
      );
      result.failed += 1;
    }
  }

  return result;
}
