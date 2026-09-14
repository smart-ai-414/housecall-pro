import { renderNonCatalogueTemplate } from "@/modules/estimates/non-catalogue-template";
import { describePriceBand } from "@/modules/perception/price-bands";
import { PRICING_BYPASS_NOTE } from "@/modules/perception/pricing-gate";
import { describeConfidence, inchesAsFeet } from "@/modules/perception/schemas";

export type SyncReason = "COMPLETED_INTAKE" | "ABANDONED_PARTIAL_LEAD";

export interface StructuredNotesHeader {
  source: string;
  reason: SyncReason;
  environment: string;
  sessionId: string;
  observed: {
    assetType: string | null;
    issueType: string | null;
    frameMaterialHint: string | null;
    classificationConfidence: number | null;
    lowConfidence: boolean;
    photoQuality: string | null;
    photoQualityProblems: string[];
    summary: string | null;
    modelVersion: string | null;
  };
  measurements: {
    widthInches: number | null;
    heightInches: number | null;
    squareFootage: number | null;
    priceBand: string | null;
    scaleReference: string | null;
    scaleReferenceNote: string | null;
    dimensionConfidence: number | null;
    customerConfirmed: boolean;
    customerCorrected: boolean;
  } | null;
  pricing: {
    bypassed: boolean;
    reasons: string[];
  };
  pricingTemplateApplies: boolean;
  customerSaid: { question: string; answer: string }[];
  safetyGlazing: {
    answered: boolean;
    mayBeRequired: boolean | null;
    answer: string | null;
  };
  unresolved: string[];
  reviewerMustCheck: string[];
  photos: { label: string; url: string }[];
}

export function humanizeEnumLabel(value: string | null): string | null {
  if (value === null) return null;
  return value.toLowerCase().replace(/_/g, " ");
}

function renderObserved(header: StructuredNotesHeader): string[] {
  const { observed } = header;

  const lines = [
    "OBSERVED BY THE ASSISTANT (not verified):",
    `  Asset: ${humanizeEnumLabel(observed.assetType) ?? "not classified"}`,
    `  Issue: ${humanizeEnumLabel(observed.issueType) ?? "not classified"}`,
    `  Frame material hint: ${humanizeEnumLabel(observed.frameMaterialHint) ?? "none"}`,
    `  Confidence: ${
      observed.classificationConfidence === null
        ? "n/a"
        : `${Math.round(observed.classificationConfidence * 100)}%`
    }${observed.lowConfidence ? " (LOW - treat with suspicion)" : ""}`,
    `  Photo quality: ${humanizeEnumLabel(observed.photoQuality) ?? "not assessed"}`,
  ];

  for (const problem of observed.photoQualityProblems) {
    lines.push(`    - ${problem}`);
  }

  if (observed.summary) lines.push(`  Summary: ${observed.summary}`);
  if (observed.modelVersion) lines.push(`  Read by: ${observed.modelVersion}`);

  return lines;
}

function renderMeasurements(header: StructuredNotesHeader): string[] {
  const measurements = header.measurements;

  if (!measurements) return ["MEASUREMENTS: none captured"];

  const { widthInches, heightInches, squareFootage } = measurements;

  const lines = ["MEASUREMENTS:"];

  if (widthInches !== null && heightInches !== null) {
    lines.push(
      `  ${measurements.customerCorrected ? "Customer measured" : "Estimated"}: ` +
        `${Math.round(widthInches)}in x ${Math.round(heightInches)}in ` +
        `(${inchesAsFeet(widthInches)}ft x ${inchesAsFeet(heightInches)}ft)`,
    );
  }

  if (squareFootage !== null) {
    lines.push(`  Square footage: about ${squareFootage.toFixed(1)} sq ft`);
  }

  if (measurements.priceBand) {
    lines.push(`  Size band: ${describePriceBand(measurements.priceBand)}`);
  }

  if (measurements.dimensionConfidence !== null) {
    lines.push(
      `  Confidence: ${describeConfidence(measurements.dimensionConfidence)} ` +
        `(${Math.round(measurements.dimensionConfidence * 100)}%)`,
    );
  }

  lines.push(
    `  Scale reference: ${
      measurements.scaleReferenceNote ??
      humanizeEnumLabel(measurements.scaleReference) ??
      "unknown"
    }`,
  );

  lines.push(
    measurements.customerConfirmed
      ? "  Customer confirmation: confirmed by the customer"
      : measurements.customerCorrected
        ? "  Customer confirmation: customer supplied their own measurement"
        : "  ! Customer confirmation: pending - do not order glass from these",
  );

  return lines;
}

function renderSafetyGlazing(header: StructuredNotesHeader): string[] {
  const { safetyGlazing } = header;

  if (!safetyGlazing.answered) {
    return ["SAFETY GLAZING: NOT ASKED", "  Verify on site before ordering."];
  }

  if (safetyGlazing.mayBeRequired === true) {
    return [
      "! SAFETY GLAZING: MAY BE REQUIRED",
      "  The customer described a location where code usually calls for it.",
      "  Confirm on site before ordering glass.",
      `  Customer said: "${safetyGlazing.answer}"`,
    ];
  }

  if (safetyGlazing.mayBeRequired === false) {
    return [
      "SAFETY GLAZING: NONE REPORTED",
      "  Customer reported none of the triggering locations.",
      "  Still verify on site - this is their reading, not a survey.",
      `  Customer said: "${safetyGlazing.answer}"`,
    ];
  }

  return [
    "SAFETY GLAZING: UNKNOWN",
    "  Customer was unsure. Treat as unknown and verify on site.",
    `  Customer said: "${safetyGlazing.answer}"`,
  ];
}

export function renderNotes(header: StructuredNotesHeader): string {
  const lines: string[] = [
    `-- AI ESTIMATOR REPORT -- ${header.source} -- ${header.environment}`,
    "",
    `Reason for sync: ${
      header.reason === "COMPLETED_INTAKE"
        ? "Customer completed intake"
        : "Customer went silent; partial lead"
    }`,
    `Session: ${header.sessionId}`,
    "",
  ];

  if (header.pricing.bypassed) {
    lines.push(PRICING_BYPASS_NOTE);
    for (const reason of header.pricing.reasons) {
      lines.push(`  - ${reason}`);
    }
    lines.push("");
  }

  lines.push(...renderObserved(header), "");
  lines.push(...renderMeasurements(header), "");

  if (header.customerSaid.length > 0) {
    lines.push("WHAT THE CUSTOMER SAID:");
    for (const entry of header.customerSaid) {
      lines.push(`  ${entry.question}`);
      lines.push(`    "${entry.answer}"`);
    }
    lines.push("");
  }

  lines.push(...renderSafetyGlazing(header), "");

  if (header.unresolved.length > 0) {
    lines.push(`UNRESOLVED (${header.unresolved.length}):`);
    for (const item of header.unresolved) {
      lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  if (header.reviewerMustCheck.length > 0) {
    lines.push("REVIEWER MUST CHECK:");
    for (const item of header.reviewerMustCheck) {
      lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  if (header.pricingTemplateApplies) {
    lines.push(...renderNonCatalogueTemplate(), "");
  }

  if (header.photos.length > 0) {
    lines.push("PHOTOS:");
    for (const photo of header.photos) {
      lines.push(`  ${photo.label}: ${photo.url}`);
    }
    lines.push("");
  }

  lines.push(
    "------------------------------------------------------------",
    "This estimate was created unsent. Prices come from the price book, not from the assistant.",
  );

  return lines.join("\n");
}
