import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { InboxInteractionMode } from "@/lib/inbox-interaction-mode";
import type { OnboardingPreferencesMemory } from "@/lib/onboarding/conversation-copy";
import {
  defaultEmotionalMemoryState,
  readEmotionalMemory,
  writeEmotionalMemory,
} from "@/lib/emotional-memory/store";
import type {
  EmotionalActionKind,
  EmotionalMemoryState,
  OnboardingStyle,
} from "@/lib/emotional-memory/types";
import { FAST_ONBOARDING_MS } from "@/lib/emotional-memory/types";

const SESSION_BUFFER_KEY = "handled:emotional-session-buffer";

type SessionBuffer = {
  reply: number;
  done: number;
  skip: number;
  volumeAtStart: number;
  startedAt: number;
};

function readSessionBuffer(): SessionBuffer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_BUFFER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionBuffer;
  } catch {
    return null;
  }
}

function writeSessionBuffer(buffer: SessionBuffer): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_BUFFER_KEY, JSON.stringify(buffer));
  } catch {
    /* ignore */
  }
}

function mergeSessionIntoState(state: EmotionalMemoryState, buffer: SessionBuffer): void {
  state.actions.reply += buffer.reply;
  state.actions.done += buffer.done;
  state.actions.skip += buffer.skip;
  state.recentSessions = [
    ...state.recentSessions.slice(-4),
    {
      at: buffer.startedAt,
      reply: buffer.reply,
      done: buffer.done,
      skip: buffer.skip,
      volumeAtStart: buffer.volumeAtStart,
    },
  ];
}

function inferOnboardingStyle(
  durationMs: number | null,
  memory: OnboardingPreferencesMemory,
  senderRefreshCount: number,
): OnboardingStyle {
  const exploratory =
    memory.importantCount >= 2 ||
    memory.promoCount >= 2 ||
    senderRefreshCount >= 2 ||
    memory.noneOfThese;
  if (exploratory) return "exploratory";
  if (memory.skipped || (durationMs !== null && durationMs < FAST_ONBOARDING_MS)) {
    return "fast";
  }
  return null;
}

/** Call once when the inbox surface mounts for a returning user. */
export function recordEmotionalSessionStart(inboxVolume = 0): EmotionalMemoryState {
  const state = readEmotionalMemory();
  const now = Date.now();
  const gapMs = state.lastVisitAt ? now - state.lastVisitAt : Infinity;

  // Flush any stale session buffer from a previous tab session.
  const stale = readSessionBuffer();
  if (stale) mergeSessionIntoState(state, stale);

  if (gapMs > 30 * 60 * 1000 || state.totalSessions === 0) {
    state.totalSessions += 1;
  }

  state.lastVisitAt = now;
  writeEmotionalMemory(state);

  writeSessionBuffer({
    reply: 0,
    done: 0,
    skip: 0,
    volumeAtStart: inboxVolume,
    startedAt: now,
  });

  return state;
}

function bumpSessionAction(kind: Exclude<EmotionalActionKind, "open">): void {
  const buffer = readSessionBuffer() ?? {
    reply: 0,
    done: 0,
    skip: 0,
    volumeAtStart: 0,
    startedAt: Date.now(),
  };
  buffer[kind] += 1;
  writeSessionBuffer(buffer);

  const state = readEmotionalMemory();
  state.actions[kind] += 1;
  writeEmotionalMemory(state);
}

export function recordEmotionalAction(kind: EmotionalActionKind): void {
  if (kind === "open") {
    const state = readEmotionalMemory();
    state.actions.open += 1;
    writeEmotionalMemory(state);
    return;
  }
  bumpSessionAction(kind);
}

export function mapCompletionToEmotionalAction(
  actionId: CompletionActionId,
): EmotionalActionKind {
  if (actionId === "replied") return "reply";
  return "done";
}

export function recordOnboardingComplete(input: {
  preferencesMemory: OnboardingPreferencesMemory;
  durationMs: number;
  senderRefreshCount: number;
}): void {
  const state = readEmotionalMemory();
  state.preferencesMemory = input.preferencesMemory;
  state.lastOnboardingDurationMs = input.durationMs;
  state.onboardingStyle = inferOnboardingStyle(
    input.durationMs,
    input.preferencesMemory,
    input.senderRefreshCount,
  );
  writeEmotionalMemory(state);
}

export function savePreferredInboxMode(mode: InboxInteractionMode): void {
  const state = readEmotionalMemory();
  state.savedInboxMode = mode;
  writeEmotionalMemory(state);
}

export function getSavedInboxMode(): InboxInteractionMode | null {
  return readEmotionalMemory().savedInboxMode;
}

export function resetEmotionalMemoryForTests(): void {
  if (typeof window === "undefined") return;
  writeEmotionalMemory(defaultEmotionalMemoryState());
  sessionStorage.removeItem(SESSION_BUFFER_KEY);
  sessionStorage.removeItem("handled:emotional-welcome-shown");
}
