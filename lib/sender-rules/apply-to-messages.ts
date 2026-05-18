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

/** Optimistically recategorize all inbox rows matching a learned sender rule. */
export function applySenderRuleToMessages<T extends InboxMessageForSenderApply>(
  messages: T[],
  senderLine: string,
  category: InboxAiCategory,
): { messages: T[]; affectedIds: string[] } {
  const pref = preferenceFromSender(senderLine, category);
  const affectedIds: string[] = [];

  const next = messages.map((m) => {
    if (!senderMatchesPreference({ sender: m.sender }, pref)) return m;
    if (m.category === category) return m;
    affectedIds.push(m.id);
    return { ...m, category, categorySource: "sender_rule" as const };
  });

  return { messages: next, affectedIds };
}
