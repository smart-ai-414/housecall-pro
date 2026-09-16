"use client";

import { Camera, Check, Loader2, Sparkles } from "lucide-react";
import { useRef } from "react";

import type { PhotoType } from "@/generated/prisma/enums";
import { PHOTO_TYPE_GUIDANCE } from "@/modules/photos/photo-requirements";
import { StreamCard } from "@/modules/intake/components/ChatWidget/StreamCard";

const ACCEPT_ATTRIBUTE =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif";

function PhotoFramingHint() {
  return (
    <div className="border-border-strong bg-surface-sunken flex items-center justify-center gap-4 rounded-xl border border-dashed p-3">
      <svg
        width="62"
        height="78"
        viewBox="0 0 62 78"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1"
          y="1"
          width="60"
          height="76"
          rx="3"
          stroke="#C4CCCF"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <rect
          x="16"
          y="20"
          width="30"
          height="34"
          stroke="#5796A5"
          strokeWidth="2"
        />
        <path d="M31 20v34" stroke="#5796A5" strokeWidth="2" />
        <path d="M6 6h50" stroke="#B8842A" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M6 72h50"
          stroke="#B8842A"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <p className="max-w-[9.5rem] text-[12.5px] leading-[18px] text-slate-500">
        Ceiling and floor both visible — that is the scale I measure from.
      </p>
    </div>
  );
}

export function PhotoUploadRow({
  photoType,
  isUploading,
  isDisabled,
  isOptional = false,
  showFramingHint = false,
  stepLabel,
  onSelect,
  onDecline,
}: {
  photoType: PhotoType;
  isUploading: boolean;
  isDisabled: boolean;
  isOptional?: boolean;
  showFramingHint?: boolean;
  stepLabel?: string;
  onSelect: (file: File) => void;
  onDecline?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const guidance = PHOTO_TYPE_GUIDANCE[photoType];

  return (
    <StreamCard icon={Camera} label={stepLabel ?? guidance.label}>
      <p className="text-brand-800 text-[14.5px] leading-[23px]">
        {guidance.instruction}
      </p>

      {showFramingHint ? <PhotoFramingHint /> : null}

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

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={isDisabled || isUploading}
          onClick={() => inputRef.current?.click()}
          className="bg-brand-700 hover:bg-brand-900 disabled:bg-brand-200 inline-flex h-11.5 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-[14.5px] font-semibold text-white"
        >
          {isUploading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Uploading
            </>
          ) : (
            <>
              <Camera className="size-4" aria-hidden="true" />
              Take a photo
            </>
          )}
        </button>

        {isOptional && onDecline ? (
          <button
            type="button"
            disabled={isDisabled}
            onClick={onDecline}
            className="text-brand-600 hover:text-brand-900 inline-flex h-11.5 items-center px-3 text-[13.5px] font-semibold"
          >
            I cannot get this one
          </button>
        ) : null}
      </div>
    </StreamCard>
  );
}

export function PhotoCompleteNotice() {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-700">
      <Check className="size-4 shrink-0" aria-hidden="true" />
      Both photos received.
    </p>
  );
}

export function PerceptionRunningNotice() {
  return (
    <div className="border-brand-200 bg-brand-50 flex flex-col gap-3 rounded-2xl border p-4.5">
      <p className="text-brand-800 flex items-center gap-2.5 text-[15px] font-semibold">
        <Sparkles className="size-5 shrink-0 animate-pulse" aria-hidden="true" />
        Reading your photos
      </p>
      <p className="text-brand-600 text-[13.5px] leading-5">
        Finding something of known size to measure against — usually the ceiling
        height or the brick coursing.
      </p>
      <span
        aria-hidden="true"
        className="bg-brand-200 h-[3px] overflow-hidden rounded-full"
      >
        <span className="bg-accent-500 block h-[3px] w-2/3 rounded-full" />
      </span>
    </div>
  );
}

export function PhotoUploadUnavailableNotice() {
  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-800">
      Photo upload is not switched on yet. Describe the damage below and leave
      your details, and a glazier will follow up to measure and price the work.
    </p>
  );
}
