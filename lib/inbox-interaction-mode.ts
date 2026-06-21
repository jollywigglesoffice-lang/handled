export type InboxInteractionMode = "standard" | "inbox_zero";

const STORAGE_KEY = "handled:inbox-interaction-mode";
export const INBOX_INTERACTION_MODE_EVENT = "handled-inbox-interaction-mode-changed";

export function readInboxInteractionMode(): InboxInteractionMode {
  if (typeof window === "undefined") return "standard";
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return value === "inbox_zero" ? "inbox_zero" : "standard";
  } catch {
    return "standard";
  }
}

export function writeInboxInteractionMode(mode: InboxInteractionMode): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new Event(INBOX_INTERACTION_MODE_EVENT));
  } catch {
    /* private mode */
  }
}
