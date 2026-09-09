import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/core/utils/cn";

const INPUT_CLASSES =
  "block w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-border-strong placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600 disabled:bg-surface-sunken disabled:text-slate-500";

const INVALID_CLASSES = "ring-red-500 focus:ring-red-600";

export function Input({
  className,
  invalid = false,
  ...props
}: ComponentPropsWithoutRef<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(INPUT_CLASSES, invalid && INVALID_CLASSES, className)}
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
        "min-h-24 resize-y font-mono",
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
      className={cn(INPUT_CLASSES, invalid && INVALID_CLASSES, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
