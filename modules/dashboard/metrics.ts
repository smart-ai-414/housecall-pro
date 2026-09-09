import { prisma } from "@/core/db/prisma";
import { readFromDatabase, type DatabaseRead } from "@/core/db/read-guard";

export interface DashboardMetrics {
  sessionsTotal: number;
  sessionsLast7Days: number;
  awaitingCustomer: number;
  pendingReview: number;
  needsReviewerCompletion: number;
  syncFailures: number;
  syncedSessions: number;
  abandonedSessions: number;
}

const OPEN_SESSION_STATUSES = ["QUESTIONING", "NEEDS_CALLBACK"] as const;

function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export function readDashboardMetrics(): Promise<
  DatabaseRead<DashboardMetrics>
> {
  return readFromDatabase("dashboardMetrics", async () => {
    const [
      sessionsTotal,
      sessionsLast7Days,
      awaitingCustomer,
      pendingReview,
      needsReviewerCompletion,
      syncFailures,
      syncedSessions,
      abandonedSessions,
    ] = await Promise.all([
      prisma.customerSession.count(),
      prisma.customerSession.count({
        where: { createdAt: { gte: sevenDaysAgo() } },
      }),
      prisma.customerSession.count({
        where: { status: { in: [...OPEN_SESSION_STATUSES] } },
      }),
      prisma.estimate.count({ where: { status: "CREATED_UNSENT" } }),
      prisma.catalogueMatch.count({
        where: { needsReviewerCompletion: true },
      }),
      prisma.estimate.count({ where: { status: "SYNC_FAILED" } }),
      prisma.customerSession.count({ where: { status: "SYNCED" } }),
      prisma.customerSession.count({ where: { status: "ABANDONED" } }),
    ]);

    return {
      sessionsTotal,
      sessionsLast7Days,
      awaitingCustomer,
      pendingReview,
      needsReviewerCompletion,
      syncFailures,
      syncedSessions,
      abandonedSessions,
    };
  });
}

export function formatConversionRate(metrics: DashboardMetrics): string {
  if (metrics.sessionsTotal === 0) return "—";
  const rate = (metrics.syncedSessions / metrics.sessionsTotal) * 100;
  return `${rate.toFixed(0)}%`;
}
