import { normalizePersonalCompletionActions } from "@/lib/completion-actions/storage";
import type { PersonalCompletionAction } from "@/lib/completion-actions/types";

export const LOCAL_COMPLETION_ACTIONS_KEY = "handled_completion_actions_v1";
export const COMPLETION_ACTIONS_HEADER = "x-handled-completion-actions";
export const COMPLETION_ACTIONS_EVENT = "handled-completion-actions-changed";

export function loadClientCompletionActions(): PersonalCompletionAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_COMPLETION_ACTIONS_KEY);
    if (!raw) return [];
    return normalizePersonalCompletionActions(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveClientCompletionActions(actions: PersonalCompletionAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCAL_COMPLETION_ACTIONS_KEY,
      JSON.stringify(normalizePersonalCompletionActions(actions)),
    );
    window.dispatchEvent(new Event(COMPLETION_ACTIONS_EVENT));
  } catch {
    /* ignore */
  }
}

export function completionActionsHeaders(): HeadersInit {
  const list = loadClientCompletionActions();
  if (!list.length) return {};
  try {
    return {
      [COMPLETION_ACTIONS_HEADER]: btoa(unescape(encodeURIComponent(JSON.stringify(list)))),
    };
  } catch {
    return {};
  }
}
