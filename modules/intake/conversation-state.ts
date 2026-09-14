import { randomUUID } from "node:crypto";

import { z } from "zod";

export const MAX_STORED_MESSAGES = 200;
export const MAX_MESSAGE_LENGTH = 2000;
export const CONVERSATION_STATE_VERSION = 1;

export const chatRoleSchema = z.enum(["assistant", "customer", "system"]);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  at: z.string(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const collectedDetailsSchema = z.object({
  name: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  serviceAddress: z.string().nullable().default(null),
  answeredQuestionIds: z.array(z.string()).default([]),
  answers: z.record(z.string(), z.string()).default({}),
});

export type CollectedDetails = z.infer<typeof collectedDetailsSchema>;

export const conversationStateSchema = z.object({
  version: z.number().int().default(CONVERSATION_STATE_VERSION),
  messages: z.array(chatMessageSchema).default([]),
  collected: collectedDetailsSchema.default({
    name: null,
    phone: null,
    email: null,
    serviceAddress: null,
    answeredQuestionIds: [],
    answers: {},
  }),
});

export type ConversationState = z.infer<typeof conversationStateSchema>;

export const EMPTY_CONVERSATION_STATE: ConversationState = {
  version: CONVERSATION_STATE_VERSION,
  messages: [],
  collected: {
    name: null,
    phone: null,
    email: null,
    serviceAddress: null,
    answeredQuestionIds: [],
    answers: {},
  },
};

export function parseConversationState(value: unknown): ConversationState {
  const parsed = conversationStateSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_CONVERSATION_STATE;
}

export function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: randomUUID(),
    role,
    content: content.slice(0, MAX_MESSAGE_LENGTH),
    at: new Date().toISOString(),
  };
}

export function appendMessages(
  state: ConversationState,
  ...messages: ChatMessage[]
): ConversationState {
  const combined = [...state.messages, ...messages];
  const overflow = Math.max(0, combined.length - MAX_STORED_MESSAGES);

  return {
    ...state,
    messages: overflow > 0 ? combined.slice(overflow) : combined,
  };
}

export function mergeCollectedDetails(
  state: ConversationState,
  patch: Partial<CollectedDetails>,
): ConversationState {
  return {
    ...state,
    collected: {
      ...state.collected,
      ...patch,
      answeredQuestionIds: [
        ...new Set([
          ...state.collected.answeredQuestionIds,
          ...(patch.answeredQuestionIds ?? []),
        ]),
      ],
      answers: { ...state.collected.answers, ...(patch.answers ?? {}) },
    },
  };
}

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export function toPlainJson(state: ConversationState): JsonObject {
  return conversationStateSchema.parse(state) as unknown as JsonObject;
}

export function visibleTranscript(
  state: ConversationState,
): { role: ChatRole; content: string; at: string }[] {
  return state.messages
    .filter((message) => message.role !== "system")
    .map(({ role, content, at }) => ({ role, content, at }));
}
