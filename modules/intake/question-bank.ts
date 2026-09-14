export type QuestionId =
  | "CONTACT_DETAILS"
  | "SERVICE_ADDRESS"
  | "WHAT_HAPPENED"
  | "PANE_COUNT"
  | "GLASS_TYPE_MARKING"
  | "SAFETY_GLAZING_CONTEXT"
  | "OPENING_COUNT"
  | "ACCESS_HEIGHT"
  | "FIXED_VS_OPERABLE"
  | "TEMPORARY_SECURING";

export interface BankedQuestion {
  id: QuestionId;
  prompt: string;
  helper?: string;
  answerKind: "text" | "choice";
  choices?: readonly string[];
}

export const QUESTION_BANK: Record<QuestionId, BankedQuestion> = {
  CONTACT_DETAILS: {
    id: "CONTACT_DETAILS",
    prompt: "What name and phone number should we put on the estimate?",
    helper: "A mobile number is best, so we can text you the estimate.",
    answerKind: "text",
  },
  SERVICE_ADDRESS: {
    id: "SERVICE_ADDRESS",
    prompt: "What is the address where the work is needed?",
    helper: "Street, city, state and ZIP.",
    answerKind: "text",
  },
  WHAT_HAPPENED: {
    id: "WHAT_HAPPENED",
    prompt: "What happened to the glass?",
    answerKind: "choice",
    choices: [
      "Cracked",
      "Shattered or a hole",
      "Foggy or cloudy between the panes",
      "Scratched",
      "The frame or hardware is damaged",
      "Something else",
    ],
  },
  PANE_COUNT: {
    id: "PANE_COUNT",
    prompt: "Is the glass a single pane, or a double-glazed unit?",
    helper:
      "Look at the edge of the glass. Two sheets with a spacer between them is double glazing.",
    answerKind: "choice",
    choices: ["Single pane", "Double glazed", "Not sure"],
  },
  GLASS_TYPE_MARKING: {
    id: "GLASS_TYPE_MARKING",
    prompt:
      "Is there a small etched marking in one corner of the glass? If so, what does it say?",
    helper:
      "It is usually a stamp in the corner naming the maker and a standard. It tells us whether the pane is safety glass.",
    answerKind: "text",
  },
  SAFETY_GLAZING_CONTEXT: {
    id: "SAFETY_GLAZING_CONTEXT",
    prompt:
      "Does any of this describe where the glass is? Tell me all that apply.",
    helper:
      "Next to a door, in a bathroom, or low down near the floor usually means the code calls for safety glass. It changes what we order, so it is worth getting right.",
    answerKind: "choice",
    choices: [
      "Right beside a door",
      "In a bathroom or shower",
      "The bottom of the glass is below knee height",
      "In a stair or hallway",
      "None of these",
      "Not sure",
    ],
  },
  OPENING_COUNT: {
    id: "OPENING_COUNT",
    prompt: "How many separate panes or openings need work?",
    answerKind: "choice",
    choices: ["Just one", "Two", "Three", "Four or more"],
  },
  ACCESS_HEIGHT: {
    id: "ACCESS_HEIGHT",
    prompt: "How far off the ground is the glass on the outside?",
    helper: "Anything above the ground floor changes the access we need.",
    answerKind: "choice",
    choices: [
      "Ground level",
      "First floor, reachable from a ladder",
      "Second floor or higher",
    ],
  },
  FIXED_VS_OPERABLE: {
    id: "FIXED_VS_OPERABLE",
    prompt: "Does that window or door open, or is the glass fixed in place?",
    helper:
      "A fixed pane usually has to be worked from outside as well as inside, which changes the access we need to bring.",
    answerKind: "choice",
    choices: [
      "It opens",
      "It is fixed and does not open",
      "One part opens, one part is fixed",
      "Not sure",
    ],
  },
  TEMPORARY_SECURING: {
    id: "TEMPORARY_SECURING",
    prompt: "Is the opening secure right now, or is it open to the weather?",
    helper: "If it is open we will treat it as urgent.",
    answerKind: "choice",
    choices: [
      "Boarded or taped up",
      "Open to the weather",
      "Glass still in place",
    ],
  },
};

export const MAX_QUESTIONS_PER_SESSION = 4;

export const FORM_ANSWERED_QUESTION_IDS: readonly QuestionId[] = [
  "CONTACT_DETAILS",
  "SERVICE_ADDRESS",
];

export const OPENING_QUESTION_SEQUENCE: readonly QuestionId[] = [
  "CONTACT_DETAILS",
  "SERVICE_ADDRESS",
  "WHAT_HAPPENED",
  "SAFETY_GLAZING_CONTEXT",
  "ACCESS_HEIGHT",
  "FIXED_VS_OPERABLE",
];

export const DORMANT_QUESTION_IDS: readonly QuestionId[] = [
  "PANE_COUNT",
  "GLASS_TYPE_MARKING",
  "OPENING_COUNT",
  "TEMPORARY_SECURING",
];

export function conversationalQuestionsIn(
  sequence: readonly QuestionId[],
): QuestionId[] {
  return sequence.filter((id) => !FORM_ANSWERED_QUESTION_IDS.includes(id));
}

export const SAFETY_GLAZING_QUESTION_ID: QuestionId = "SAFETY_GLAZING_CONTEXT";

const SAFETY_GLAZING_NEGATIVE_ANSWERS = ["none of these", "no", "none"];

export function safetyGlazingMayBeRequired(
  answer: string | null,
): boolean | null {
  if (answer === null) return null;

  const normalized = answer.trim().toLowerCase();
  if (normalized === "") return null;

  if (normalized.includes("not sure") || normalized.includes("unsure")) {
    return null;
  }

  if (SAFETY_GLAZING_NEGATIVE_ANSWERS.some((value) => normalized === value)) {
    return false;
  }

  return true;
}

export function isQuestionId(value: unknown): value is QuestionId {
  return typeof value === "string" && value in QUESTION_BANK;
}

export function questionsById(ids: readonly string[]): BankedQuestion[] {
  return ids.filter(isQuestionId).map((id) => QUESTION_BANK[id]);
}
