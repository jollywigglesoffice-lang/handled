import type { CompletionActionId } from "@/lib/completion-actions/types";
import { isPersonalCompletionActionId } from "@/lib/completion-actions/slug";
import type { EmailActionState } from "@/lib/action-intelligence/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Categories that almost always need a deliberate action. */
const URGENT_CATEGORIES: ReadonlySet<InboxAiCategory> = new Set([
  "worth_your_attention",
]);

/** Categories where "no action needed" is a reasonable default. */
const LOW_ACTION_CATEGORIES: ReadonlySet<InboxAiCategory> = new Set([
  "promotions",
  "newsletters",
  "good_to_know",
]);

export type CompletionActionContext = {
  category: InboxAiCategory;
  /** AI/heuristic confidence for the inbox category (0–1). */
  categoryConfidence?: number;
  /** Action intelligence: true when the email looks actionable. */
  actionable?: boolean;
  /** Tri-state posture — passive suppresses proactive completion noise. */
  actionState?: EmailActionState;
  /** Learned suggestion confidence (0–1) when filtering suggestions. */
  suggestionConfidence?: number;
};

/** True when the email category implies the user should take action. */
export function isUrgentActionCategory(category: InboxAiCategory): boolean {
  return URGENT_CATEGORIES.has(category);
}

/**
 * "No action needed" is only appropriate for low-priority mail with very high
 * confidence that nothing is required.
 */
export function shouldOfferNoActionNeeded(ctx: CompletionActionContext): boolean {
  if (ctx.actionState === "passive") return true;
  if (ctx.actionState === "actionable" || ctx.actionState === "waiting_response") return false;
  if (ctx.actionable === true) return false;
  if (isUrgentActionCategory(ctx.category)) return false;

  if (LOW_ACTION_CATEGORIES.has(ctx.category)) {
    return true;
  }

  // good_to_know and other categories: require extremely high AI confidence
  const confidence = ctx.categoryConfidence ?? 0;
  return confidence >= 0.92;
}

/** Reorder and filter picker actions based on email context. */
export function contextAwarePickerOrder(
  fullOrder: CompletionActionId[],
  ctx: CompletionActionContext,
): CompletionActionId[] {
  const showNoAction = shouldOfferNoActionNeeded(ctx);
  const system = fullOrder.filter(
    (id) => !isPersonalCompletionActionId(id) && (id !== "no_action_needed" || showNoAction),
  );
  const personal = fullOrder.filter((id) => isPersonalCompletionActionId(id));

  if (isUrgentActionCategory(ctx.category)) {
    const priority: CompletionActionId[] = [
      "replied",
      "waiting_on_someone",
      "took_action",
      "forwarded",
      "saved_for_reference",
    ];
    const ordered = priority.filter((id) => system.includes(id));
    const rest = system.filter((id) => !ordered.includes(id));
    return [...ordered, ...rest, ...personal];
  }

  return [...system, ...personal];
}

/** Suppress learned completion suggestions for passive or urgent/actionable mail. */
export function shouldSuppressCompletionSuggestion(
  actionId: CompletionActionId,
  ctx: CompletionActionContext,
): boolean {
  if (ctx.actionState === "passive") return true;
  if (actionId !== "no_action_needed") return false;
  if (ctx.actionState === "actionable" || ctx.actionState === "waiting_response") return true;
  if (ctx.actionable === true) return true;
  if (isUrgentActionCategory(ctx.category)) return true;
  if (LOW_ACTION_CATEGORIES.has(ctx.category)) return false;
  const confidence = ctx.suggestionConfidence ?? ctx.categoryConfidence ?? 0;
  return confidence < 0.95;
}
