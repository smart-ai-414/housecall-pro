"use client";

import { Camera, Check, Loader2, Sparkles } from "lucide-react";
import { useRef } from "react";

import type { PhotoType } from "@/generated/prisma/enums";
import { PHOTO_TYPE_GUIDANCE } from "@/modules/photos/photo-requirements";

const ACCEPT_ATTRIBUTE =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif";

export function PhotoUploadRow({
  photoType,
  isUploading,
  isDisabled,
  isOptional = false,
  onSelect,
  onDecline,
}: {
  photoType: PhotoType;
  isUploading: boolean;
  isDisabled: boolean;
  isOptional?: boolean;
  onSelect: (file: File) => void;
  onDecline?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="ring-border-subtle flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 ring-1">
      <span className="text-sm font-medium text-slate-800">
        {PHOTO_TYPE_GUIDANCE[photoType].label}
        {isOptional && onDecline ? (
          <button
            type="button"
            disabled={isDisabled}
            onClick={onDecline}
            className="mt-0.5 block text-xs font-normal text-slate-500 underline"
          >
            I cannot get this one
          </button>
        ) : null}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
          event.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={isDisabled || isUploading}
        onClick={() => inputRef.current?.click()}
        className="bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
      >
        {isUploading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Uploading
          </>
        ) : (
          <>
            <Camera className="size-3.5" aria-hidden="true" />
            Add photo
          </>
        )}
      </button>
    </div>
  );
}

export function PhotoCompleteNotice() {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-900 ring-1 ring-green-200 ring-inset">
      <Check className="size-4" aria-hidden="true" />
      Both photos received.
    </p>
  );
}

export function PerceptionRunningNotice() {
  return (
    <p className="text-brand-900 ring-brand-200 bg-brand-50 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset">
      <Sparkles className="size-4 animate-pulse" aria-hidden="true" />
      Looking at your photos…
    </p>
  );
}

export function PhotoUploadUnavailableNotice() {
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
      Photo upload is not switched on yet. Describe the damage below and leave
      your details, and a glazier will follow up to measure and price the work.
    </p>
  );
}
