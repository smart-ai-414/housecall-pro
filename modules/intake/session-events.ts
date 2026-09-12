import { prisma } from "@/core/db/prisma";
import type { SessionEventType } from "@/generated/prisma/enums";
import type { JsonObject } from "@/modules/intake/conversation-state";

export async function recordSessionEvent(
  sessionId: string,
  eventType: SessionEventType,
  detail: JsonObject = {},
): Promise<void> {
  try {
    await prisma.sessionEvent.create({
      data: { sessionId, eventType, detail },
    });
  } catch (error) {
    console.warn(
      `[session-events] could not record ${eventType} for ${sessionId}`,
      error instanceof Error ? error.message : error,
    );
  }
}

export interface SessionEventEntry {
  eventType: SessionEventType;
  detail: unknown;
  createdAt: Date;
}

export async function readSessionEvents(
  sessionId: string,
): Promise<SessionEventEntry[]> {
  return prisma.sessionEvent.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { eventType: true, detail: true, createdAt: true },
  });
}
