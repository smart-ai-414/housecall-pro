import { perceptionEnv } from "@/core/config/env";
import {
  isLowConfidence,
  PROVISIONAL_LOW_CONFIDENCE_THRESHOLD,
  type ClassificationResult,
  type PhotoQualityResult,
} from "@/modules/perception/schemas";

export interface PricingGateDecision {
  shouldBypassPricing: boolean;
  reasons: string[];
}

export function confidenceThreshold(): number {
  try {
    return perceptionEnv().PERCEPTION_CONFIDENCE_THRESHOLD;
  } catch {
    return PROVISIONAL_LOW_CONFIDENCE_THRESHOLD;
  }
}

export function assessPricingGate({
  classification,
  photoQuality,
}: {
  classification: ClassificationResult | null;
  photoQuality: PhotoQualityResult | null;
}): PricingGateDecision {
  const threshold = confidenceThreshold();
  const reasons: string[] = [];

  if (classification === null) {
    reasons.push("The assistant could not classify the job at all.");
  } else {
    if (isLowConfidence(classification.confidence, threshold)) {
      reasons.push(
        `Classification confidence ${classification.confidence.toFixed(2)} is below the ${threshold.toFixed(2)} threshold.`,
      );
    }
    if (classification.assetType === "UNKNOWN") {
      reasons.push(
        "The assistant could not tell what kind of opening this is.",
      );
    }
    if (classification.issueType === "UNKNOWN") {
      reasons.push(
        "The assistant could not tell what is wrong with the glass.",
      );
    }
  }

  if (photoQuality === null) {
    reasons.push(
      "The photographs were never assessed, so nothing confirms they are good enough to price from.",
    );
  } else if (photoQuality.overall === "UNUSABLE") {
    reasons.push("The photographs are not usable.");
  }

  return { shouldBypassPricing: reasons.length > 0, reasons };
}

export const PRICING_BYPASS_NOTE =
  "LOW CONFIDENCE — pricing bypassed, manual review required";
