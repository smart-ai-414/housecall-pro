import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/core/utils/cn";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-700 text-white shadow-xs hover:bg-brand-900 disabled:bg-brand-200",
  accent:
    "bg-accent-500 text-white shadow-xs hover:bg-accent-600 disabled:bg-accent-200",
  secondary:
    "border border-border-strong bg-white text-brand-800 hover:bg-surface-sunken disabled:text-slate-400",
  ghost: "bg-transparent text-brand-600 hover:bg-brand-50 hover:text-brand-900",
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-200",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed";

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonOwnProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={cn(
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonOwnProps & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      className={cn(
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
