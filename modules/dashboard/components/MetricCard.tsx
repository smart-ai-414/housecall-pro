import type { LucideIcon } from "lucide-react";

import { cn } from "@/core/utils/cn";

export type MetricTone = "neutral" | "waiting" | "stalled";

const TONE_CLASSES: Record<
  MetricTone,
  { card: string; label: string; value: string; caption: string }
> = {
  neutral: {
    card: "border-border-subtle bg-white",
    label: "text-slate-500",
    value: "text-brand-950",
    caption: "text-slate-400",
  },
  waiting: {
    card: "border-amber-200 bg-amber-50/40",
    label: "text-amber-800",
    value: "text-amber-800",
    caption: "text-amber-700",
  },
  stalled: {
    card: "border-red-200 bg-red-50/40",
    label: "text-red-700",
    value: "text-red-700",
    caption: "text-red-600",
  },
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
  tone?: MetricTone;
}) {
  const classes = TONE_CLASSES[tone];

  return (
    <div
      className={cn(
        "shadow-xs flex flex-col gap-2.5 rounded-xl border p-4.5",
        classes.card,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-[12.5px] font-semibold",
          classes.label,
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </p>
      <p
        className={cn(
          "font-display text-3xl leading-8 font-bold tracking-[-0.02em]",
          classes.value,
        )}
      >
        {value}
      </p>
      <p className={cn("text-[12.5px] leading-[18px]", classes.caption)}>
        {caption}
      </p>
    </div>
  );
}
