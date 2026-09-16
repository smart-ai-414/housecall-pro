import { prisma } from "@/core/db/prisma";
import { readFromDatabase, type DatabaseRead } from "@/core/db/read-guard";
import type { SessionStatus } from "@/generated/prisma/enums";
import type { CapturedSummary } from "@/modules/intake/types";

export interface SessionRecap {
  customerName: string | null;
  summary: CapturedSummary;
  outstandingQuestionCount: number;
  lastCustomerMessageAt: Date | null;
}

export async function readSessionRecap(
  sessionId: string,
): Promise<SessionRecap | null> {
  const session = await prisma.customerSession.findUnique({
    where: { id: sessionId },
    select: {
      customerName: true,
      outstandingQuestions: true,
      lastCustomerMessageAt: true,
      _count: { select: { photos: true } },
      dimensionEstimates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          widthInches: true,
          heightInches: true,
          customerConfirmed: true,
        },
      },
      classifications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { assetType: true, issueType: true },
      },
    },
  });

  if (!session) return null;

  const dimensions = session.dimensionEstimates[0] ?? null;
  const classification = session.classifications[0] ?? null;

  return {
    customerName: session.customerName,
    outstandingQuestionCount: session.outstandingQuestions.length,
    lastCustomerMessageAt: session.lastCustomerMessageAt,
    summary: {
      photoCount: session._count.photos,
      widthInches: dimensions?.widthInches ?? null,
      heightInches: dimensions?.heightInches ?? null,
      dimensionsConfirmed: dimensions?.customerConfirmed ?? false,
      assetType: classification?.assetType ?? null,
      issueType: classification?.issueType ?? null,
    },
  };
}

export interface SessionListRow {
  id: string;
  status: SessionStatus;
  customerName: string | null;
  customerPhone: string | null;
  serviceAddress: string | null;
  locationName: string | null;
  photoCount: number;
  isTestRecord: boolean;
  createdAt: Date;
  lastCustomerMessageAt: Date | null;
}

const SESSION_PAGE_SIZE = 50;

export const SESSION_FILTERS = [
  "ALL",
  "AWAITING",
  "SYNCED",
  "ABANDONED",
  "UNROUTED",
] as const;

export type SessionFilter = (typeof SESSION_FILTERS)[number];

export const SESSION_FILTER_LABELS: Record<SessionFilter, string> = {
  ALL: "All",
  AWAITING: "Awaiting customer",
  SYNCED: "Synced",
  ABANDONED: "Abandoned",
  UNROUTED: "Unrouted",
};

type SessionWhere = NonNullable<
  Parameters<typeof prisma.customerSession.count>[0]
>["where"];

const SESSION_FILTER_WHERE: Record<SessionFilter, SessionWhere> = {
  ALL: {},
  AWAITING: { status: { in: ["QUESTIONING", "NEEDS_CALLBACK"] } },
  SYNCED: { status: "SYNCED" },
  ABANDONED: { status: "ABANDONED" },
  UNROUTED: { franchiseLocationId: null },
};

export function isSessionFilter(value: unknown): value is SessionFilter {
  return (
    typeof value === "string" &&
    (SESSION_FILTERS as readonly string[]).includes(value)
  );
}

export type SessionFilterCounts = Record<SessionFilter, number>;

export function readSessionFilterCounts(): Promise<
  DatabaseRead<SessionFilterCounts>
> {
  return readFromDatabase("readSessionFilterCounts", async () => {
    const entries = await Promise.all(
      SESSION_FILTERS.map(async (filter) => {
        const count = await prisma.customerSession.count({
          where: SESSION_FILTER_WHERE[filter],
        });
        return [filter, count] as const;
      }),
    );

    return Object.fromEntries(entries) as SessionFilterCounts;
  });
}

export function listRecentSessions(
  filter: SessionFilter = "ALL",
): Promise<DatabaseRead<SessionListRow[]>> {
  return readFromDatabase("listRecentSessions", async () => {
    const sessions = await prisma.customerSession.findMany({
      where: SESSION_FILTER_WHERE[filter],
      orderBy: { createdAt: "desc" },
      take: SESSION_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        customerName: true,
        customerPhone: true,
        serviceAddress: true,
        isTestRecord: true,
        createdAt: true,
        lastCustomerMessageAt: true,
        franchiseLocation: { select: { name: true } },
        _count: { select: { photos: true } },
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      status: session.status,
      customerName: session.customerName,
      customerPhone: session.customerPhone,
      serviceAddress: session.serviceAddress,
      locationName: session.franchiseLocation?.name ?? null,
      photoCount: session._count.photos,
      isTestRecord: session.isTestRecord,
      createdAt: session.createdAt,
      lastCustomerMessageAt: session.lastCustomerMessageAt,
    }));
  });
}
