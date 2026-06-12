import type { InboxAiCategory, CategorySource } from "@/lib/inbox-ai-categories";
import { lookupScopedValue } from "@/lib/gmail/account-types";

export type MessageWithCategory = {
  id: string;
  accountId?: string;
  category: InboxAiCategory;
  categorySource?: CategorySource;
  categoryConfidence?: number;
};

/**
 * Force per-email manual overrides onto message rows (server + client).
 * Override maps are keyed by `accountId:emailId` (raw emailId for legacy
 * records) because Gmail ids are only unique within one mailbox.
 */
export function stampEmailOverridesOnMessages<T extends MessageWithCategory>(
  messages: T[],
  emailOverrides: Record<string, InboxAiCategory>,
): T[] {
  if (!Object.keys(emailOverrides).length) return messages;

  return messages.map((message) => {
    const forced = lookupScopedValue(emailOverrides, message.id, message.accountId);
    if (!forced) return message;
    if (message.category === forced && message.categorySource === "manual_override") {
      return message;
    }
    return {
      ...message,
      category: forced,
      categorySource: "manual_override" as const,
      categoryConfidence: 1,
    };
  });
}
