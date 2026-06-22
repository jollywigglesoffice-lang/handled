import type {
  EmotionalMemoryState,
  EmotionalTone,
  WorkPace,
  WorkStyleProfile,
} from "@/lib/emotional-memory/types";

function totalActions(state: EmotionalMemoryState): number {
  const { reply, done, skip, open } = state.actions;
  return reply + done + skip + open;
}

function skipRatio(state: EmotionalMemoryState): number {
  const total = totalActions(state);
  if (total === 0) return 0;
  return state.actions.skip / total;
}

function replyRatio(state: EmotionalMemoryState): number {
  const total = totalActions(state);
  if (total === 0) return 0;
  return state.actions.reply / total;
}

function completionRatio(state: EmotionalMemoryState): number {
  const total = totalActions(state);
  if (total === 0) return 0;
  return (state.actions.reply + state.actions.done) / total;
}

function recentOverloadSignal(state: EmotionalMemoryState): boolean {
  const recent = state.recentSessions.slice(-3);
  if (recent.length === 0) return false;
  return recent.some(
    (s) => s.volumeAtStart >= 40 && s.reply + s.done < 2 && s.skip >= 2,
  );
}

function deriveEmotionalTone(state: EmotionalMemoryState): EmotionalTone {
  const skip = skipRatio(state);
  const completion = completionRatio(state);

  if (recentOverloadSignal(state) || skip >= 0.45) return "needs_space";
  if (completion >= 0.55 && replyRatio(state) >= 0.2) return "confident";
  if (skip <= 0.15 && completion >= 0.35) return "calm";
  return "balanced";
}

function derivePace(state: EmotionalMemoryState): WorkPace {
  if (state.onboardingStyle === "exploratory") return "exploratory";
  const reply = replyRatio(state);
  const completion = completionRatio(state);
  if (reply >= 0.25 || (completion >= 0.5 && skipRatio(state) <= 0.2)) {
    return "fast_responder";
  }
  if (state.onboardingStyle === "fast") return "fast_responder";
  return "steady";
}

/** Derive a soft work-style profile from accumulated behavior. */
export function deriveWorkStyleProfile(state: EmotionalMemoryState): WorkStyleProfile {
  const tone = deriveEmotionalTone(state);
  const pace = derivePace(state);
  const skip = skipRatio(state);
  const prefs = state.preferencesMemory;

  let densityPreference: WorkStyleProfile["densityPreference"] = "balanced";
  if (tone === "needs_space" || skip >= 0.35 || prefs?.skipped) {
    densityPreference = "minimal";
  } else if (
    pace === "exploratory" ||
    (prefs?.importantCount ?? 0) >= 2 ||
    (prefs?.promoCount ?? 0) >= 2
  ) {
    densityPreference = "detailed";
  }

  let filteringStrength: WorkStyleProfile["filteringStrength"] = "normal";
  if (tone === "needs_space" || densityPreference === "minimal") {
    filteringStrength = "aggressive";
  } else if (pace === "exploratory" || densityPreference === "detailed") {
    filteringStrength = "light";
  }

  return {
    densityPreference,
    filteringStrength,
    pace,
    emotionalTone: tone,
  };
}

export function isReturningUser(state: EmotionalMemoryState): boolean {
  return state.totalSessions > 1;
}
