import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="border-brand-100 bg-brand-50 flex size-12 items-center justify-center rounded-xl border">
        <Icon className="text-brand-600 size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-base font-semibold text-brand-950">
          {title}
        </p>
        <p className="mx-auto max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
