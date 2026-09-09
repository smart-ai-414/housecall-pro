import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { EstimateStatus, SessionStatus } from "@/generated/prisma/enums";

const SESSION_STATUS_TONES: Record<SessionStatus, BadgeTone> = {
  STARTED: "active",
  PHOTOS_RECEIVED: "active",
  CLASSIFYING: "active",
  QUESTIONING: "waiting",
  MATCHING: "active",
  SYNCED: "done",
  ABANDONED: "stalled",
  NEEDS_CALLBACK: "waiting",
};

const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  STARTED: "Started",
  PHOTOS_RECEIVED: "Photos received",
  CLASSIFYING: "Classifying",
  QUESTIONING: "Awaiting customer",
  MATCHING: "Matching catalogue",
  SYNCED: "Synced",
  ABANDONED: "Abandoned",
  NEEDS_CALLBACK: "Needs callback",
};

const ESTIMATE_STATUS_TONES: Record<EstimateStatus, BadgeTone> = {
  SYNC_PENDING: "waiting",
  SYNC_FAILED: "stalled",
  CREATED_UNSENT: "brand",
  SENT: "active",
  APPROVED: "done",
  REJECTED: "stalled",
};

const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  SYNC_PENDING: "Sync pending",
  SYNC_FAILED: "Sync failed",
  CREATED_UNSENT: "Draft, unsent",
  SENT: "Sent to customer",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Badge tone={SESSION_STATUS_TONES[status]}>
      {SESSION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function EstimateStatusBadge({ status }: { status: EstimateStatus }) {
  return (
    <Badge tone={ESTIMATE_STATUS_TONES[status]}>
      {ESTIMATE_STATUS_LABELS[status]}
    </Badge>
  );
}
