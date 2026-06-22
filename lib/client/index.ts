/**
 * Client layer — browser orchestration (storage sync, API calls).
 * UI components should prefer `app/hooks/*` over importing this directly.
 */
export {
  submitCategoryFeedback,
  type CategoryFeedbackInput,
  type CategoryFeedbackResult,
} from "@/lib/client/categorization/submit-feedback";

export {
  collectCategoryCorrection,
  collectUserOverrideLog,
  collectActionMemory,
  collectEmailOpened,
  collectEmailViewedWithoutAction,
} from "@/lib/client/memory/collect";

export {
  applyDoneInboxEffects,
  revertDoneInboxEffects,
} from "@/lib/client/inbox-truth/apply-done-effects";
