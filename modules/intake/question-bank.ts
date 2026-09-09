export type QuestionId =
  | "CONTACT_DETAILS"
  | "SERVICE_ADDRESS"
  | "WHAT_HAPPENED"
  | "PANE_COUNT"
  | "GLASS_TYPE_MARKING"
  | "OPENING_COUNT"
  | "ACCESS_HEIGHT"
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

export const OPENING_QUESTION_SEQUENCE: readonly QuestionId[] = [
  "WHAT_HAPPENED",
  "SERVICE_ADDRESS",
  "CONTACT_DETAILS",
];

export function isQuestionId(value: unknown): value is QuestionId {
  return typeof value === "string" && value in QUESTION_BANK;
}

export function questionsById(ids: readonly string[]): BankedQuestion[] {
  return ids.filter(isQuestionId).map((id) => QUESTION_BANK[id]);
}
