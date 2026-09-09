"use client";

import { Camera } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { openEstimateChat } from "@/modules/intake/components/open-chat-event";

export function StartEstimateButton({
  size = "lg",
  variant = "primary",
  label = "Get an estimate",
}: {
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary";
  label?: string;
}) {
  return (
    <Button size={size} variant={variant} onClick={openEstimateChat}>
      <Camera className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
