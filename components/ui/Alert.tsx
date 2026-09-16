import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/core/utils/cn";

export type AlertTone = "error" | "success" | "info" | "warning";

const TONE_CLASSES: Record<AlertTone, string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  success: "bg-green-50 text-green-700 border-green-200",
  info: "bg-brand-50 text-brand-800 border-brand-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
};

const TONE_ICONS: Record<AlertTone, typeof Info> = {
  error: ShieldAlert,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

export function Alert({
  tone = "info",
  title,
  className,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  className?: string;
  children?: ReactNode;
}) {
  const Icon = TONE_ICONS[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3.5 text-sm",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-5 opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}
