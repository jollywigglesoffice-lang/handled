import type { EmotionalMemoryState } from "@/lib/emotional-memory/types";
import { EMOTIONAL_MEMORY_STORAGE_KEY } from "@/lib/emotional-memory/types";

export function defaultEmotionalMemoryState(): EmotionalMemoryState {
  return {
    version: 1,
    totalSessions: 0,
    lastVisitAt: null,
    actions: { reply: 0, done: 0, skip: 0, open: 0 },
    recentSessions: [],
    onboardingStyle: null,
    preferencesMemory: null,
    savedInboxMode: null,
    lastOnboardingDurationMs: null,
  };
}

export function readEmotionalMemory(): EmotionalMemoryState {
  if (typeof window === "undefined") return defaultEmotionalMemoryState();
  try {
    const raw = localStorage.getItem(EMOTIONAL_MEMORY_STORAGE_KEY);
    if (!raw) return defaultEmotionalMemoryState();
    const parsed = JSON.parse(raw) as Partial<EmotionalMemoryState>;
    if (parsed.version !== 1) return defaultEmotionalMemoryState();
    return {
      ...defaultEmotionalMemoryState(),
      ...parsed,
      actions: { ...defaultEmotionalMemoryState().actions, ...parsed.actions },
      recentSessions: Array.isArray(parsed.recentSessions) ? parsed.recentSessions : [],
    };
  } catch {
    return defaultEmotionalMemoryState();
  }
}

export function writeEmotionalMemory(state: EmotionalMemoryState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EMOTIONAL_MEMORY_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("handled-emotional-memory-changed"));
  } catch {
    /* private mode / quota */
  }
}

export const EMOTIONAL_MEMORY_CHANGED_EVENT = "handled-emotional-memory-changed";
