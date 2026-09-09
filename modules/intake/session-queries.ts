import { prisma } from "@/core/db/prisma";
import { readFromDatabase, type DatabaseRead } from "@/core/db/read-guard";
import type { SessionStatus } from "@/generated/prisma/enums";

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

export function listRecentSessions(): Promise<DatabaseRead<SessionListRow[]>> {
  return readFromDatabase("listRecentSessions", async () => {
    const sessions = await prisma.customerSession.findMany({
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
