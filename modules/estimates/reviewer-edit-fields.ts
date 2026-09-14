export const REVIEWER_EDIT_FIELDS = [
  "assetType",
  "issueType",
  "frameMaterialHint",
  "widthInches",
  "heightInches",
  "serviceItem",
  "other",
] as const;

export type ReviewerEditField = (typeof REVIEWER_EDIT_FIELDS)[number];

export const REVIEWER_EDIT_FIELD_LABELS: Record<ReviewerEditField, string> = {
  assetType: "Asset type",
  issueType: "Issue type",
  frameMaterialHint: "Frame material",
  widthInches: "Width (inches)",
  heightInches: "Height (inches)",
  serviceItem: "Service item chosen",
  other: "Something else",
};
