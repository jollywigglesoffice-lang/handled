/**
 * Category system — SINGLE public entry point for assigning inbox categories.
 *
 * All category assignment flows through `categorizeGmailInboxRows`.
 * Do not import final-resolution helpers from UI or client layers.
 */
export {
  categorizeGmailInboxRows,
  intelligentFallbackCategory,
  heuristicInboxCategory,
  type CategorizeInboxOptions,
  type GmailInboxRowCategorized,
} from "@/lib/domain/categorization/categorize-inbox";

export {
  loadCategorizationContext,
  loadCategorizationRulesForUser,
  type CategorizationContext,
} from "@/lib/domain/categorization/load-context";

export { previewInboxTriage } from "@/lib/domain/categorization/preview-triage";

export type {
  CategoryResolutionAudit,
  CategoryResolutionContext,
  CategoryResolutionResult,
} from "@/lib/domain/categorization/final-resolution";

/** @internal Server/domain pipeline only — not for UI or client layers. */
export { resolveFinalCategory } from "@/lib/domain/categorization/final-resolution";

export {
  CANONICAL_INBOX_CATEGORIES,
  isCanonicalInboxCategory,
} from "@/lib/domain/categorization/canonical";

export { logCategoryResolutionDebug } from "@/lib/domain/categorization/debug";
