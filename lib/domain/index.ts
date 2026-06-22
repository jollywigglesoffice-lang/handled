/**
 * Domain layer — pure business logic.
 * No React, no Supabase client calls, no middleware.
 */
export {
  resolveFinalCategory,
  type CategoryResolutionContext,
  type CategoryResolutionInput,
  type CategoryResolutionResult,
  type CategoryResolutionAudit,
} from "@/lib/domain/categorization/final-resolution";

export {
  categorizeGmailInboxRows,
  intelligentFallbackCategory,
  heuristicInboxCategory,
  type CategorizeInboxOptions,
  type GmailInboxRowCategorized,
} from "@/lib/domain/categorization/categorize-inbox";

export { loadCategorizationContext as loadUserCategorizationContext } from "@/lib/domain/categorization/load-context";

export { previewInboxTriage } from "@/lib/domain/categorization/preview-triage";

export {
  lookupMemoryCategory,
  lookupSenderMemoryCategory,
  lookupCorrectionHistoryCategory,
} from "@/lib/domain/memory/apply";
