export * from "@/lib/inbox-user-rules/types";
export * from "@/lib/inbox-user-rules/match";
export * from "@/lib/inbox-user-rules/apply";
export * from "@/lib/inbox-user-rules/presets";
export * from "@/lib/inbox-user-rules/store";

/**
 * Categorization execution order (documented contract):
 *
 * 1. USER PRE-RULES     — block, force_category (highest priority)
 * 2. SYSTEM RULES       — ruleClassify() deterministic bulk/billing detection
 * 3. AI BATCH           — ambiguous rows only
 * 4. INTELLIGENT FALLBACK
 * 5. USER POST-RULES    — demote / boost on final category
 */
