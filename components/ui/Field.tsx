import type { ReactNode } from "react";

import { cn } from "@/core/utils/cn";

interface FieldProps {
  htmlFor: string;
  label: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  htmlFor,
  label,
  hint,
  errors,
  required = false,
  className,
  children,
}: FieldProps) {
  const hasErrors = Boolean(errors && errors.length > 0);
  const describedBy = [
    hint ? `${htmlFor}-hint` : null,
    hasErrors ? `${htmlFor}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold tracking-[0.03em] text-slate-500 uppercase"
      >
        {label}
        {required ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-slate-400">
          {hint}
        </p>
      ) : null}

      <div aria-describedby={describedBy || undefined}>{children}</div>

      {hasErrors ? (
        <ul id={`${htmlFor}-error`} className="space-y-0.5">
          {errors?.map((message) => (
            <li key={message} className="text-xs font-medium text-red-700">
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
