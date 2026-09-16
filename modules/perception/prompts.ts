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
  "CRACKED — one or more fracture lines run through the pane but the glass is still",
  "  in its frame and still weatherproof. Impact cracks radiate from a point; stress",
  "  cracks wander and often start at an edge.",
  "SHATTERED — the pane is broken through, missing, boarded, taped or spidered into",
  "  fragments. Tempered glass fails this way as a field of small cubes, not shards.",
  "SEAL_FAILURE — haze, milky cloudiness, streaking or visible droplets BETWEEN the",
  "  two panes of a sealed unit, so wiping either surface would not clear it. It is",
  "  often worst at the bottom edge and worse in direct sun. Do not confuse it with",
  "  condensation or dirt on a surface, which is not a seal failure.",
  "SCRATCHED — surface damage only: scoring, etching or scuffing with no fracture",
  "  through the thickness.",
  "HARDWARE_OR_FRAME — the glass is sound and the fault is the frame, hinge, roller,",
  "  track, lock or sash. A sliding door that will not run is this, not a glass fault.",
  "OTHER — glass work that none of the above describes",
  "UNKNOWN — you cannot tell from these photographs",
].join("\n");

const FRAME_MATERIAL_CAVEAT = [
  "Frame material is a HINT, not a finding. Painted frames read as whatever the paint",
  "is, and vinyl, aluminium and fibreglass all look alike once coated. Answer VINYL,",
  "ALUMINIUM, WOOD or FIBREGLASS only when an unpainted edge, a weld seam, a thermal",
  "break or wood grain actually shows. Otherwise answer UNKNOWN.",
].join("\n");

const SCALE_REFERENCES = [
  "1. HEAD_HEIGHT — strongest. A door head or window head sits about 80 to 84 inches",
  "   from the floor in residential work, and floor-to-ceiling is usually 96 inches.",
  "   The ratio between that and the opening is close to one to one, so the error",
  "   stays small.",
  "2. BRICK_COURSING — strong, from an exterior photograph. One brick course with its",
  "   mortar joint runs about 2.7 inches, so three courses are about 8 inches. Count",
  "   several courses rather than one: the individual errors average out.",
  "3. INTERIOR_FIXTURE — moderate. Outlet centres sit about 15 inches off the floor,",
  "   worktops about 36 inches, interior door leaves about 80 inches tall.",
  "4. DELIBERATE_SCALE_OBJECT — good when present and rarely is: a credit card, a tape",
  "   measure or a similar object of known size the customer placed in the frame.",
  "5. FRAME_FACE — weakest, use last. A frame face is about 2 to 3 inches and a glazing",
  "   bar under an inch, so any error in reading it multiplies roughly thirtyfold",
  "   across the opening. Prefer NO_REFERENCE_FOUND over a frame-face estimate you are",
  "   not confident in.",
].join("\n");

export const UNKNOWN_IS_ALWAYS_ALLOWED =
  "UNKNOWN is always a valid answer and is strongly preferred over a guess. A wrong confident answer costs more than an honest unknown.";

const HONEST_CONFIDENCE = [
  "Report confidence as what you would actually bet, not as reassurance. A person",
  "reads this number and decides whether to trust the rest. Reserve values above 0.8",
  "for what the photographs plainly show; when you are working from a partial view, a",
  "reflection, or an inference about what is behind a frame, say so with a number",
  "below 0.6.",
].join("\n");

export function observationPrompt(input: PerceptionInput): string {
  return [
    OBSERVER_ROLE,
    "",
    "Read these photographs together as one job, not as separate scenes: they are",
    "different views of the same opening. Report two separate things about them.",
    "",
    "FIRST, under classification, say what the job is.",
    "",
    "Asset type, choose exactly one:",
    ASSET_FAMILIES,
    "",
    "Issue type, choose exactly one:",
    ISSUE_TYPES,
    "",
    "Frame material hint, choose one of VINYL, ALUMINIUM, WOOD, FIBREGLASS, UNKNOWN.",
    FRAME_MATERIAL_CAVEAT,
    "",
    UNKNOWN_IS_ALWAYS_ALLOWED,
    "",
    HONEST_CONFIDENCE,
    "Report one confidence between 0 and 1 for the classification as a whole.",
    "",
    "In classification reasoning, write one or two plain sentences a glazier could",
    "read at a glance, naming what you saw that decided it.",
    "",
    "SECOND, under photoQuality, judge the photographs themselves.",
    "",
    "This is a separate judgement from the classification, and the two do not have to",
    "agree. Grade what is in front of you, not how confident you felt above: a sharp",
    "photograph of an opening you still cannot classify is GOOD, and a lucky guess",
    "from a dark blurred photograph is still POOR.",
    "",
    "Grade overall as GOOD, ADEQUATE, POOR or UNUSABLE. Grade UNUSABLE when the",
    "photographs do not show a glazed opening at all, or are too dark, blurred or",
    "obstructed to read anything from. List specific problems such as glare, motion",
    "blur, the opening being cut off, or the photograph showing something other than",
    "the damaged glass.",
    "",
    "Set shouldRequestCornerCloseUp only when the frame type or the glass type cannot",
    "be told from what is here AND a close-up of one corner of the glass would settle",
    "it. Asking costs the customer effort, so do not ask when the answer is already",
    "visible or when a close-up would not help.",
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
    "Work down this list and use the strongest reference actually visible:",
    SCALE_REFERENCES,
    "",
    "If none of them is visible, answer NO_REFERENCE_FOUND. Do not guess from apparent",
    "proportions alone — an estimate with no reference is worse than none, because it",
    "will be read back to the customer as though it meant something.",
    "",
    "You do not need to be right to the inch. You need to be right about which size",
    "band the opening falls in, so a reference that is roughly right beats a",
    "measurement that looks precise and is not.",
    "",
    "Report width and height in inches, which reference you used, and a confidence",
    "between 0 and 1.",
    "",
    HONEST_CONFIDENCE,
    "",
    "In reasoning, name the reference you used and the value you read from it, for",
    "example: head height visible at about 82 inches, used as the primary reference.",
    "",
    `The customer wrote: ${JSON.stringify(input.customerDescription)}`,
  ].join("\n");
}

