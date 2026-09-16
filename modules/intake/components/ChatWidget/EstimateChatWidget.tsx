"use client";

import { Lock, MessageSquare, Phone, Send, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BRAND } from "@/core/config/branding";
import { cn } from "@/core/utils/cn";
import { ChatTranscript } from "@/modules/intake/components/ChatWidget/ChatTranscript";
import { CompletionNotice } from "@/modules/intake/components/ChatWidget/CompletionNotice";
import { ContactDetailsForm } from "@/modules/intake/components/ChatWidget/ContactDetailsForm";
import { DimensionConfirmationRow } from "@/modules/intake/components/ChatWidget/DimensionConfirmationRow";
import {
  PerceptionRunningNotice,
  PhotoUploadRow,
  PhotoUploadUnavailableNotice,
} from "@/modules/intake/components/ChatWidget/PhotoUploadRow";
import { ProgressRail } from "@/modules/intake/components/ChatWidget/ProgressRail";
import { ResumeLinkRow } from "@/modules/intake/components/ChatWidget/ResumeLinkRow";
import {
  useIntakeSession,
  type StoredCredentials,
} from "@/modules/intake/components/ChatWidget/useIntakeSession";
import { useTurnstileToken } from "@/modules/intake/components/ChatWidget/useTurnstileToken";
import { OPEN_ESTIMATE_CHAT_EVENT } from "@/modules/intake/components/open-chat-event";
import { needsContactDetails, stageForSession } from "@/modules/intake/progress";
import { isRequiredPhotoType } from "@/modules/photos/photo-requirements";
import type { IntakeSessionView } from "@/modules/intake/types";
import type { IntakeSessionController } from "@/modules/intake/components/ChatWidget/useIntakeSession";

export interface EstimateChatWidgetProps {
  variant?: "floating" | "inline";
  resumeCredentials?: StoredCredentials | null;
}

function ActiveStep({
  session,
  intake,
}: {
  session: IntakeSessionView;
  intake: IntakeSessionController;
}) {
  if (session.isComplete) {
    return (
      <CompletionNotice
        locationName={session.locationName}
        summary={session.capturedSummary}
      />
    );
  }

  if (!session.photoUploadAvailable) return <PhotoUploadUnavailableNotice />;

  const [nextPhotoType] = session.outstandingPhotoTypes;

  if (nextPhotoType) {
    const totalPhotos = Math.max(
      session.requestedPhotoTypes.length,
      session.outstandingPhotoTypes.length,
    );
    const photoNumber = totalPhotos - session.outstandingPhotoTypes.length + 1;
    const isRequired = isRequiredPhotoType(nextPhotoType);

    return (
      <PhotoUploadRow
        photoType={nextPhotoType}
        stepLabel={isRequired ? `Photo ${photoNumber} of ${totalPhotos}` : undefined}
        showFramingHint={photoNumber === 1}
        isUploading={intake.uploadingPhotoType === nextPhotoType}
        isDisabled={intake.uploadingPhotoType !== null}
        isOptional={!isRequired}
        onSelect={(file) => void intake.uploadPhoto(nextPhotoType, file)}
        onDecline={() => void intake.declinePhoto(nextPhotoType)}
      />
    );
  }

  if (intake.isAnalyzing || session.perceptionPending) {
    return <PerceptionRunningNotice />;
  }

  if (session.pendingDimensionConfirmation) {
    return (
      <DimensionConfirmationRow
        prompt={session.pendingDimensionConfirmation}
        isSubmitting={intake.isSending}
        onRespond={(input) => void intake.confirmDimensions(input)}
      />
    );
  }

  if (needsContactDetails(session)) {
    return (
      <ContactDetailsForm
        isSubmitting={intake.isSending}
        onSubmit={(draft) => void intake.submitContactDetails(draft)}
      />
    );
  }

  return null;
}

export function EstimateChatWidget({
  variant = "floating",
  resumeCredentials = null,
}: EstimateChatWidgetProps = {}) {
  const isInline = variant === "inline";
  const [isOpen, setIsOpen] = useState(isInline);
  const [draft, setDraft] = useState("");
  const {
    setContainer: setTurnstileContainer,
    token: turnstileToken,
    isReady: isTurnstileReady,
  } = useTurnstileToken(isOpen && resumeCredentials === null);
  const intake = useIntakeSession(resumeCredentials, turnstileToken);

  useEffect(() => {
    if (isInline) return;
    const handleOpenRequest = () => setIsOpen(true);
    window.addEventListener(OPEN_ESTIMATE_CHAT_EVENT, handleOpenRequest);
    return () =>
      window.removeEventListener(OPEN_ESTIMATE_CHAT_EVENT, handleOpenRequest);
  }, [isInline]);

  useEffect(() => {
    if (isOpen && isTurnstileReady) void intake.start();
  }, [isOpen, isTurnstileReady, intake]);

  const session = intake.session;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-accent-500 hover:bg-accent-600 shadow-lg fixed right-5 bottom-5 z-40 inline-flex h-14 items-center gap-2.5 rounded-full px-6 text-[15.5px] font-semibold text-white"
      >
        <MessageSquare className="size-5" aria-hidden="true" />
        Get an estimate
      </button>
    );
  }

  return (
    <section
      aria-label="Estimate assistant"
      className={cn(
        "border-border-strong flex flex-col overflow-hidden border bg-white",
        isInline
          ? "shadow-lg h-[min(46rem,100dvh)] w-full sm:h-[min(46rem,85dvh)] sm:rounded-2xl"
          : "shadow-xl fixed inset-x-0 bottom-0 z-40 h-[min(41.25rem,92dvh)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[25rem] sm:rounded-2xl",
      )}
    >
      <header
        className={cn(
          "flex flex-col gap-3 px-5 pt-4 pb-3.5",
          session?.isComplete ? "bg-green-700" : "bg-ink",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="font-display text-[15px] font-semibold text-white">
              Estimate assistant
            </p>
            <p
              className={cn(
                "text-xs",
                session?.isComplete ? "text-green-200" : "text-brand-300",
              )}
            >
              {session?.locationName
                ? `Handled by ${session.locationName}`
                : "A person reviews every estimate"}
            </p>
          </div>
          {isInline ? null : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close the estimate assistant"
              className="text-brand-300 rounded-lg p-1 hover:text-white"
            >
              <X className="size-4.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {session ? (
          <ProgressRail
            stage={stageForSession(session)}
            isComplete={session.isComplete}
          />
        ) : null}
      </header>

      {intake.error ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3">
          <p className="text-sm text-red-700">{intake.error}</p>
          <div className="mt-1.5 flex gap-4">
            <button
              type="button"
              onClick={intake.dismissError}
              className="text-xs font-semibold text-red-700 underline"
            >
              Dismiss
            </button>
            <a
              href={BRAND.phoneHref}
              className="text-xs font-semibold text-red-700 underline"
            >
              Call {BRAND.phone}
            </a>
          </div>
        </div>
      ) : null}

      {intake.isStarting || !session ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-slate-500">
            {intake.error ? "Could not start a session." : "Starting…"}
          </p>
          <div ref={setTurnstileContainer} />
        </div>
      ) : (
        <>
          <ChatTranscript entries={session.transcript} isBusy={intake.isSending}>
            <ActiveStep session={session} intake={intake} />
          </ChatTranscript>

          <div className="border-border-subtle bg-surface-muted flex flex-col gap-3 border-t px-4 py-3.5">
            <form
              className="flex items-center gap-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = draft.trim();
                if (trimmed.length === 0 || intake.isSending) return;
                setDraft("");
                void intake.sendMessage(trimmed);
              }}
            >
              <label className="flex-1">
                <span className="sr-only">Your message</span>
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    session.isComplete
                      ? "Add anything else you remember"
                      : "Type anything — or answer above"
                  }
                  className="border-border-strong focus:border-brand-500 focus:ring-brand-500/20 max-h-24 w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-[15px] placeholder:text-slate-400 focus:ring-3 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={draft.trim().length === 0 || intake.isSending}
                aria-label="Send message"
                className="bg-brand-700 hover:bg-brand-900 disabled:bg-brand-200 inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-white"
              >
                <Send className="size-[19px]" aria-hidden="true" />
              </button>
            </form>

            {session.isComplete ? (
              <a
                href={BRAND.phoneHref}
                className="border-border-strong hover:bg-surface-sunken text-brand-800 inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-white text-sm font-semibold"
              >
                <Phone className="size-4" aria-hidden="true" />
                Call {BRAND.phone} instead
              </a>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-400">
                <Lock className="size-3.5" aria-hidden="true" />
                Photos are stripped of location data
              </span>
              <ResumeLinkRow resumeToken={session.resumeToken} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
