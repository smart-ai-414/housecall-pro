"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { cn } from "@/core/utils/cn";
import type { TranscriptEntry } from "@/modules/intake/types";

export function ChatTranscript({
  entries,
  isBusy,
  children,
}: {
  entries: readonly TranscriptEntry[];
  isBusy: boolean;
  children?: ReactNode;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length, isBusy, children]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-6 sm:px-7"
      role="log"
      aria-live="polite"
      aria-label="Estimate conversation"
    >
      {entries.map((entry, index) => (
        <p
          key={`${entry.at}-${index}`}
          className={cn(
            "max-w-[86%] px-4 py-3 text-[15px] leading-6 whitespace-pre-line sm:max-w-[78%]",
            entry.role === "customer"
              ? "bg-brand-700 self-end rounded-2xl rounded-br-[4px] text-white"
              : "border-brand-100 bg-brand-50 text-brand-800 self-start rounded-2xl rounded-bl-[4px] border",
          )}
        >
          {entry.content}
        </p>
      ))}

      {isBusy ? (
        <p className="border-brand-100 bg-brand-50 self-start rounded-2xl rounded-bl-[4px] border px-4 py-3 text-[15px] text-slate-500">
          Typing…
        </p>
      ) : null}

      {children}

      <div ref={endRef} />
    </div>
  );
}
