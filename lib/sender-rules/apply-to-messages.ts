import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  preferenceFromSender,
  senderMatchesPreference,
} from "@/lib/inbox-sender-preferences";
import type { CategorySource } from "@/lib/inbox-ai-categories";

export type InboxMessageForSenderApply = {
  id: string;
  sender: string;
  category: InboxAiCategory;
  categorySource?: CategorySource;
};

/**
 * Optimistically recategorize all inbox rows matching a learned sender rule.
 *
 * Per-email manual overrides outrank sender rules, so messages already
 * resolved as `manual_override` are never touched — sender-scope changes must
 * not mask or overwrite persisted manual overrides.
 */
export function applySenderRuleToMessages<T extends InboxMessageForSenderApply>(
  messages: T[],
  senderLine: string,
  category: InboxAiCategory,
  options?: { triggerEmailId?: string },
): { messages: T[]; affectedIds: string[] } {
  const pref = preferenceFromSender(senderLine, category);
  const affectedIds: string[] = [];

  const next = messages.map((m) => {
    if (!senderMatchesPreference({ sender: m.sender }, pref)) return m;
    // The email the user acted on may move; other manually-set emails may not.
    if (m.categorySource === "manual_override" && m.id !== options?.triggerEmailId) {
      return m;
    }
    if (m.category === category) return m;
    affectedIds.push(m.id);
    return { ...m, category, categorySource: "sender_rule" as const };
  });

  return { messages: next, affectedIds };
}
