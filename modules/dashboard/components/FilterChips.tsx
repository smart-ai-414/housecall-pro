import Link from "next/link";

import { cn } from "@/core/utils/cn";

export interface FilterChip {
  key: string;
  label: string;
  href: string;
  count?: number;
  isActive: boolean;
}

export function FilterChips({
  chips,
  label,
}: {
  chips: readonly FilterChip[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2.5">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-current={chip.isActive ? "true" : undefined}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13.5px] transition-colors",
            chip.isActive
              ? "bg-ink border-ink font-semibold text-white"
              : "border-border-subtle hover:bg-surface-muted bg-white font-medium text-slate-700",
          )}
        >
          {chip.label}
          {chip.count === undefined ? null : (
            <span
              className={cn(
                "font-normal",
                chip.isActive ? "text-brand-300" : "text-slate-400",
              )}
            >
              {chip.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
