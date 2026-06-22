import { getDayPhase } from "@/lib/daily-rhythm";
import {
  deriveWorkStyleProfile,
  isReturningUser,
  readEmotionalMemory,
} from "@/lib/emotional-memory";
import type { PresenceAdjustments, PresencePattern } from "@/lib/presence/types";

function replyRatio(): number {
  const { reply, done, skip, open } = readEmotionalMemory().actions;
  const total = reply + done + skip + open;
  if (total === 0) return 0;
  return reply / total;
}

function doneRatio(): number {
  const { reply, done, skip, open } = readEmotionalMemory().actions;
  const total = reply + done + skip + open;
  if (total === 0) return 0;
  return (reply + done) / total;
}

/** Soft behavioral patterns — used silently, never surfaced to the user. */
export function derivePresencePatterns(): PresencePattern {
  const state = readEmotionalMemory();
  const profile = deriveWorkStyleProfile(state);
  const prefs = state.preferencesMemory;

  return {
    morningReplier:
      getDayPhase() === "morning" &&
      (profile.pace === "fast_responder" || replyRatio() >= 0.2),
    deEmphasizesNewsletters:
      (prefs?.promoCount ?? 0) > 0 ||
      profile.filteringStrength === "aggressive" ||
      profile.densityPreference === "minimal",
    batchClearer: doneRatio() >= 0.45 && state.actions.done >= 5,
    fastResponder: profile.pace === "fast_responder",
  };
}

export function resolvePresenceAdjustments(
  patterns: PresencePattern,
  options?: { stressActive?: boolean },
): PresenceAdjustments {
  const profile = deriveWorkStyleProfile(readEmotionalMemory());
  const returning = isReturningUser(readEmotionalMemory());

  let preferCategoryTab: PresenceAdjustments["preferCategoryTab"] = null;
  if (
    returning &&
    patterns.fastResponder &&
    !patterns.batchClearer &&
    profile.pace !== "exploratory"
  ) {
    preferCategoryTab = "worth_your_attention";
  }

  return {
    preferCategoryTab: options?.stressActive ? null : preferCategoryTab,
    boostActionable: patterns.morningReplier || patterns.fastResponder,
    sinkNewsletters: patterns.deEmphasizesNewsletters,
    prioritizeWaiting: patterns.batchClearer,
  };
}
