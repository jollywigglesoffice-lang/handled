export type {
  PresenceAdjustments,
  PresenceContext,
  PresenceLocale,
  PresenceObservation,
  PresencePattern,
} from "@/lib/presence/types";

export { derivePresencePatterns, resolvePresenceAdjustments } from "@/lib/presence/patterns";

export { presenceObservationLine } from "@/lib/presence/copy";

export {
  hoursSinceLastVisit,
  wasUserAway,
  markInboxPrepared,
  persistInboxVisit,
  shouldShowPresenceObservation,
  markPresenceObservationShown,
} from "@/lib/presence/visit";

export {
  scorePresenceActionable,
  pickPresenceOnboardingEmail,
  shouldPresencePrefetchReply,
} from "@/lib/presence/score";

export { applyPresenceOrderingToBuckets } from "@/lib/presence/prepare";

export {
  resolveInboxPresence,
  presenceLineForContext,
  resolvePresenceInitialTab,
} from "@/lib/presence/resolve";
