-- CreateEnum
CREATE TYPE "SessionEventType" AS ENUM ('SESSION_CREATED', 'SESSION_RESUMED', 'MESSAGE_RECEIVED', 'PHOTO_UPLOADED', 'PHOTO_REJECTED', 'CONTACT_CAPTURED', 'ROUTING_RESOLVED', 'SYNC_STARTED', 'SYNC_SUCCEEDED', 'SYNC_FAILED', 'ABANDONED');

-- CreateTable
CREATE TABLE "session_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "event_type" "SessionEventType" NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_events_session_id_created_at_idx" ON "session_events"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "session_events_event_type_created_at_idx" ON "session_events"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
