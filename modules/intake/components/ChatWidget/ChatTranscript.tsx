"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/core/utils/cn";
import type { TranscriptEntry } from "@/modules/intake/types";

export function ChatTranscript({
  entries,
  isBusy,
}: {
  entries: readonly TranscriptEntry[];
  isBusy: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length, isBusy]);

  return (
    <div
      className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      role="log"
      aria-live="polite"
      aria-label="Estimate conversation"
    >
      {entries.map((entry, index) => (
        <div
          key={`${entry.at}-${index}`}
          className={cn(
            "flex",
            entry.role === "customer" ? "justify-end" : "justify-start",
          )}
        >
          <p
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line",
              entry.role === "customer"
                ? "bg-brand-700 text-white"
                : "bg-surface-sunken text-slate-800",
            )}
          >
            {entry.content}
          </p>
        </div>
      ))}

      {isBusy ? (
        <div className="flex justify-start">
          <p className="bg-surface-sunken rounded-2xl px-3.5 py-2.5 text-sm text-slate-500">
            Typing…
          </p>
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
