import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/core/utils/cn";

export function StreamCard({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon?: LucideIcon;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border-subtle shadow-md flex flex-col gap-3.5 rounded-2xl border bg-white p-4.5",
        className,
      )}
    >
      {label ? (
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.03em] text-slate-500 uppercase">
          {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function StreamCardNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-slate-100 pt-3 text-xs leading-[18px] text-slate-400">
      {children}
    </p>
  );
}
