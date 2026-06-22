import type { CategoryTab } from "@/app/emails/category-tabs";

export type PresenceLocale = "en" | "it";

export type PresenceObservation =
  | "prioritized"
  | "organized_away"
  | "filtered_clarity"
  | "already_ready"
  | "kept_simple";

export type PresencePattern = {
  morningReplier: boolean;
  deEmphasizesNewsletters: boolean;
  batchClearer: boolean;
  fastResponder: boolean;
};

export type PresenceAdjustments = {
  /** Silent default category focus — never announced. */
  preferCategoryTab: CategoryTab | null;
  boostActionable: boolean;
  sinkNewsletters: boolean;
  prioritizeWaiting: boolean;
};

export type PresenceContext = {
  locale: PresenceLocale;
  wasAway: boolean;
  awayHours: number;
  attentionCount: number;
  waitingCount: number;
  stressActive: boolean;
  returningUser: boolean;
  patterns: PresencePattern;
  adjustments: PresenceAdjustments;
  observation: PresenceObservation | null;
};

export const PRESENCE_SESSION_KEY = "handled:presence-observation-shown";
