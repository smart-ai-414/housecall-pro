import type { ReactNode } from "react";

import { cn } from "@/core/utils/cn";

export type BadgeTone =
  "active" | "waiting" | "done" | "stalled" | "neutral" | "brand";

const TONE_CLASSES: Record<BadgeTone, string> = {
  active: "bg-brand-50 text-brand-800 border-brand-200",
  waiting: "bg-amber-50 text-amber-800 border-amber-200",
  done: "bg-green-50 text-green-700 border-green-200",
  stalled: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded border px-2.5 text-xs font-semibold whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
