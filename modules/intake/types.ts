import type { PhotoType, SessionStatus } from "@/generated/prisma/enums";
import type { ChatRole } from "@/modules/intake/conversation-state";

export interface TranscriptEntry {
  role: ChatRole;
  content: string;
  at: string;
}

export interface DimensionConfirmationPrompt {
  widthInches: number;
  heightInches: number;
  squareFootage: number;
  summary: string;
}

export interface CapturedSummary {
  photoCount: number;
  widthInches: number | null;
  heightInches: number | null;
  dimensionsConfirmed: boolean;
  assetType: string | null;
  issueType: string | null;
}

export interface IntakeSessionView {
  sessionId: string;
  resumeToken: string;
  status: SessionStatus;
  transcript: TranscriptEntry[];
  outstandingPhotoTypes: PhotoType[];
  requestedPhotoTypes: PhotoType[];
  outstandingQuestions: string[];
  locationName: string | null;
  photoUploadAvailable: boolean;
  isComplete: boolean;
  perceptionPending: boolean;
  pendingDimensionConfirmation: DimensionConfirmationPrompt | null;
  capturedSummary: CapturedSummary;
}

export interface IntakeSessionWithRouting extends IntakeSessionView {
  routingNote: string;
}

export interface SignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  maxBytes: number;
  requiredContentType: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}
