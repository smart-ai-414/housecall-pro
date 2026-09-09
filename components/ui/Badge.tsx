import type { ReactNode } from "react";

import { cn } from "@/core/utils/cn";

export type BadgeTone =
  "active" | "waiting" | "done" | "stalled" | "neutral" | "brand";

const TONE_CLASSES: Record<BadgeTone, string> = {
  active: "bg-sky-50 text-sky-800 ring-sky-200",
  waiting: "bg-amber-50 text-amber-800 ring-amber-200",
  done: "bg-green-50 text-green-800 ring-green-200",
  stalled: "bg-red-50 text-red-800 ring-red-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
