import type { PerceptionInput } from "@/modules/perception/types";

const OBSERVER_ROLE = [
  "You are assisting a glass repair company by reading customer photographs.",
  "You observe and you report uncertainty. You never price work, never name a",
  "catalogue item, and never state a figure in currency. A separate deterministic",
  "step selects the service item, and a person approves every estimate.",
].join(" ");

export const ASSET_FAMILIES = [
  "RESIDENTIAL_WINDOW — a window in a house or flat",
  "SLIDING_DOOR — a residential sliding patio door",
  "SHOWER_GLASS — shower screens, panels and enclosures",
  "COMMERCIAL_STOREFRONT — shopfront or commercial glazing, often large",
  "DOOR_GLASS — glass set into a door leaf or a sidelight",
  "MIRROR — a mirror rather than a glazed opening",
  "UNKNOWN — you cannot tell from these photographs",
].join("\n");

const ISSUE_TYPES = [
  "CRACKED — the pane is cracked but in place",
  "SHATTERED — the pane is broken through, missing, or boarded",
  "SEAL_FAILURE — fogging or moisture between two panes",
  "SCRATCHED — surface damage only",
  "HARDWARE_OR_FRAME — the frame, hinge, roller or lock is the problem",
  "OTHER — glass work that none of the above describes",
  "UNKNOWN — you cannot tell from these photographs",
].join("\n");

const SCALE_REFERENCES = [
  "HEAD_HEIGHT — doors and window heads sit near 6 ft 8 in to 7 ft from the floor",
  "BRICK_COURSING — a brick course with its mortar joint runs about 3 in",
  "INTERIOR_FIXTURE — outlets sit about 15 in to centre, worktops about 36 in",
  "DELIBERATE_SCALE_OBJECT — the customer placed an object of known size in frame",
  "FRAME_FACE — a window frame face is about 2 in, a glazing bar about 3/4 in",
].join("\n");

export const UNKNOWN_IS_ALWAYS_ALLOWED =
  "UNKNOWN is always a valid answer and is strongly preferred over a guess. A wrong confident answer costs more than an honest unknown.";

export function classificationPrompt(input: PerceptionInput): string {
  return [
    OBSERVER_ROLE,
    "",
    "Classify the job shown in these photographs.",
    "",
    "Asset type, choose exactly one:",
    ASSET_FAMILIES,
    "",
    "Issue type, choose exactly one:",
    ISSUE_TYPES,
    "",
    "Frame material hint, choose one of VINYL, ALUMINIUM, WOOD, FIBREGLASS, UNKNOWN.",
    "",
    UNKNOWN_IS_ALWAYS_ALLOWED,
    "",
    "Report confidence between 0 and 1 for the classification as a whole.",
    "",
    `The customer wrote: ${JSON.stringify(input.customerDescription)}`,
  ].join("\n");
}

export function dimensionPrompt(
  input: PerceptionInput & { assetType: string },
): string {
  return [
    OBSERVER_ROLE,
    "",
    `Estimate the size of the glass opening. The job is classified as ${input.assetType}.`,
    "",
    "Find the strongest scale reference visible, preferring the earlier entries:",
    SCALE_REFERENCES,
    "",
    "If no reference is visible, answer NO_REFERENCE_FOUND. Do not guess from",
    "apparent proportions alone — an estimate with no reference is worse than none,",
    "because it will be shown to the customer as though it meant something.",
    "",
    "Report width and height in inches, which reference you used, and a confidence",
    "between 0 and 1.",
    "",
    `The customer wrote: ${JSON.stringify(input.customerDescription)}`,
  ].join("\n");
}

export function photoQualityPrompt(input: PerceptionInput): string {
  return [
    OBSERVER_ROLE,
    "",
    "Judge whether these photographs are good enough to classify the job and read",
    "its size from a scale reference.",
    "",
    "Grade overall as GOOD, ADEQUATE, POOR or UNUSABLE. List specific problems",
    "such as glare, motion blur, the opening being cut off, or the photograph",
    "showing something other than the damaged glass.",
    "",
    "Set shouldRequestCornerCloseUp when the frame type or glass type cannot be",
    "told from what is here, and a close-up of one corner of the glass would settle it.",
    "",
    `The customer wrote: ${JSON.stringify(input.customerDescription)}`,
  ].join("\n");
}
