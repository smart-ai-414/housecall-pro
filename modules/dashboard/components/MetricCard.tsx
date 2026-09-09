import type { LucideIcon } from "lucide-react";

export function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="ring-border-subtle rounded-xl bg-white p-5 ring-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className="bg-surface-sunken flex size-8 items-center justify-center rounded-lg">
          <Icon className="size-4 text-slate-500" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </div>
  );
}
