import type { CategoryTab } from "@/app/emails/category-tabs";
import { isReturningUser, readEmotionalMemory } from "@/lib/emotional-memory";
import { derivePresencePatterns, resolvePresenceAdjustments } from "@/lib/presence/patterns";
import { presenceObservationLine } from "@/lib/presence/copy";
import type {
  PresenceContext,
  PresenceLocale,
  PresenceObservation,
} from "@/lib/presence/types";
import { hoursSinceLastVisit, wasUserAway } from "@/lib/presence/visit";

export type ResolvePresenceInput = {
  locale: PresenceLocale;
  attentionCount: number;
  waitingCount: number;
  stressActive: boolean;
  filteringAggressive: boolean;
};

function pickObservation(input: ResolvePresenceInput): PresenceObservation | null {
  const away = wasUserAway(1);
  const awayHours = hoursSinceLastVisit();
  const returning = isReturningUser(readEmotionalMemory());
  const patterns = derivePresencePatterns();

  if (input.stressActive) return null;

  if (away && awayHours >= 8 && returning) {
    return input.filteringAggressive ? "kept_simple" : "organized_away";
  }
  if (away && input.filteringAggressive) return "filtered_clarity";
  if (input.attentionCount > 0 && (patterns.fastResponder || patterns.morningReplier)) {
    return "prioritized";
  }
  if (returning && away) return "already_ready";
  if (input.filteringAggressive && patterns.deEmphasizesNewsletters) {
    return "kept_simple";
  }
  return null;
}

export function resolveInboxPresence(input: ResolvePresenceInput): PresenceContext {
  const patterns = derivePresencePatterns();
  const adjustments = resolvePresenceAdjustments(patterns, {
    stressActive: input.stressActive,
  });
  const observation = pickObservation(input);

  return {
    locale: input.locale,
    wasAway: wasUserAway(1),
    awayHours: hoursSinceLastVisit(),
    attentionCount: input.attentionCount,
    waitingCount: input.waitingCount,
    stressActive: input.stressActive,
    returningUser: isReturningUser(readEmotionalMemory()),
    patterns,
    adjustments,
    observation,
  };
}

export function presenceLineForContext(context: PresenceContext): string | null {
  if (!context.observation) return null;
  return presenceObservationLine(context.observation, context.locale);
}

export function resolvePresenceInitialTab(
  context: PresenceContext,
  counts: Record<string, number>,
): CategoryTab | null {
  const tab = context.adjustments.preferCategoryTab;
  if (!tab || tab === "all") return null;
  if ((counts[tab] ?? 0) === 0) return null;
  return tab;
}
