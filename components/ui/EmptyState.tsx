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
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="bg-surface-sunken flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5 text-slate-500" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mx-auto max-w-md text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
