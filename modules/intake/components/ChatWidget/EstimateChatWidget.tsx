"use client";

import { MessageSquare, Send, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BRAND } from "@/core/config/branding";
import { cn } from "@/core/utils/cn";
import { ChatTranscript } from "@/modules/intake/components/ChatWidget/ChatTranscript";
import { CompletionNotice } from "@/modules/intake/components/ChatWidget/CompletionNotice";
import { ContactDetailsForm } from "@/modules/intake/components/ChatWidget/ContactDetailsForm";
import { DimensionConfirmationRow } from "@/modules/intake/components/ChatWidget/DimensionConfirmationRow";
import {
  PerceptionRunningNotice,
  PhotoCompleteNotice,
  PhotoUploadRow,
  PhotoUploadUnavailableNotice,
} from "@/modules/intake/components/ChatWidget/PhotoUploadRow";
import { isRequiredPhotoType } from "@/modules/photos/photo-requirements";
import { ResumeLinkRow } from "@/modules/intake/components/ChatWidget/ResumeLinkRow";
import {
  useIntakeSession,
  type StoredCredentials,
} from "@/modules/intake/components/ChatWidget/useIntakeSession";
import { useTurnstileToken } from "@/modules/intake/components/ChatWidget/useTurnstileToken";
import { OPEN_ESTIMATE_CHAT_EVENT } from "@/modules/intake/components/open-chat-event";

export interface EstimateChatWidgetProps {
  variant?: "floating" | "inline";
  resumeCredentials?: StoredCredentials | null;
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
  const needsContactDetails =
    session !== null &&
    session.outstandingQuestions.includes("CONTACT_DETAILS");

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-brand-700 hover:bg-brand-800 fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white shadow-lg"
      >
        <MessageSquare className="size-4" aria-hidden="true" />
        Get an estimate
      </button>
    );
  }

  return (
    <section
      aria-label="Estimate assistant"
      className={cn(
        "ring-border-subtle flex flex-col overflow-hidden bg-white ring-1",
        isInline
          ? "h-[min(44rem,100dvh)] w-full sm:h-[min(44rem,85dvh)] sm:rounded-2xl sm:shadow-xl"
          : "fixed inset-x-0 bottom-0 z-40 h-[min(38rem,90dvh)] shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[26rem] sm:rounded-2xl",
      )}
    >
      <header className="border-border-subtle bg-brand-700 flex items-start justify-between gap-3 border-b px-4 py-3.5 text-white">
        <div>
          <p className="text-sm font-semibold">
            {BRAND.companyShortName} estimate assistant
          </p>
          <p className="text-brand-100 text-xs">
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
            className="hover:bg-brand-800 rounded-lg p-1"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </header>

      {intake.error ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-sm text-red-900">{intake.error}</p>
          <div className="mt-1.5 flex gap-3">
            <button
              type="button"
              onClick={intake.dismissError}
              className="text-xs font-semibold text-red-800 underline"
            >
              Dismiss
            </button>
            <a
              href={BRAND.phoneHref}
              className="text-xs font-semibold text-red-800 underline"
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
          <ChatTranscript
            entries={session.transcript}
            isBusy={intake.isSending}
          />

          <div className="border-border-subtle bg-surface-muted space-y-2 border-t px-4 py-3">
            {session.isComplete ? (
              <CompletionNotice locationName={session.locationName} />
            ) : needsContactDetails ? (
              <ContactDetailsForm
                isSubmitting={intake.isSending}
                onSubmit={(contactDraft) =>
                  void intake.submitContactDetails(contactDraft)
                }
              />
            ) : !session.photoUploadAvailable ? (
              <PhotoUploadUnavailableNotice />
            ) : session.outstandingPhotoTypes.length > 0 ? (
              session.outstandingPhotoTypes.map((photoType) => (
                <PhotoUploadRow
                  key={photoType}
                  photoType={photoType}
                  isUploading={intake.uploadingPhotoType === photoType}
                  isDisabled={intake.uploadingPhotoType !== null}
                  isOptional={!isRequiredPhotoType(photoType)}
                  onSelect={(file) => void intake.uploadPhoto(photoType, file)}
                  onDecline={() => void intake.declinePhoto(photoType)}
                />
              ))
            ) : intake.isAnalyzing || session.perceptionPending ? (
              <PerceptionRunningNotice />
            ) : session.pendingDimensionConfirmation ? (
              <DimensionConfirmationRow
                prompt={session.pendingDimensionConfirmation}
                isSubmitting={intake.isSending}
                onRespond={(input) => void intake.confirmDimensions(input)}
              />
            ) : (
              <PhotoCompleteNotice />
            )}

            <ResumeLinkRow resumeToken={session.resumeToken} />
          </div>

          <form
            className="border-border-subtle flex items-end gap-2 border-t px-3 py-3"
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
                placeholder="Type a message"
                className="ring-border-strong focus:ring-brand-600 max-h-24 w-full resize-none rounded-lg bg-white px-3 py-2 text-sm ring-1 focus:ring-2"
              />
            </label>
            <button
              type="submit"
              disabled={draft.trim().length === 0 || intake.isSending}
              aria-label="Send message"
              className={cn(
                "bg-brand-700 hover:bg-brand-800 rounded-lg p-2.5 text-white",
                "disabled:bg-brand-300",
              )}
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
