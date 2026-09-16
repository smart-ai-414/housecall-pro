"use client";

import { Camera } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { openEstimateChat } from "@/modules/intake/components/open-chat-event";

export function StartEstimateButton({
  size = "lg",
  variant = "primary",
  label = "Get an estimate",
  className,
}: {
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "accent" | "secondary";
  label?: string;
  className?: string;
}) {
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={openEstimateChat}
    >
      <Camera className="size-[19px]" aria-hidden="true" />
      {label}
    </Button>
  );
}
