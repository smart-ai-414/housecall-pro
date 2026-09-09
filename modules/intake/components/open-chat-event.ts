export const OPEN_ESTIMATE_CHAT_EVENT = "glassbot:open-estimate-chat";

export function openEstimateChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_ESTIMATE_CHAT_EVENT));
}
