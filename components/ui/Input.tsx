import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/core/utils/cn";

const INPUT_CLASSES =
  "block w-full rounded-lg border border-border-strong bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none disabled:bg-surface-sunken disabled:text-slate-500";

const CONTROL_HEIGHT = "h-11";

const INVALID_CLASSES =
  "border-red-700 focus:border-red-700 focus:ring-red-700/15";

export function Input({
  className,
  invalid = false,
  ...props
}: ComponentPropsWithoutRef<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        INPUT_CLASSES,
        CONTROL_HEIGHT,
        invalid && INVALID_CLASSES,
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid = false,
  ...props
}: ComponentPropsWithoutRef<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        INPUT_CLASSES,
        "min-h-24 resize-y py-2.5",
        invalid && INVALID_CLASSES,
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid = false,
  ...props
}: ComponentPropsWithoutRef<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        INPUT_CLASSES,
        CONTROL_HEIGHT,
        invalid && INVALID_CLASSES,
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
