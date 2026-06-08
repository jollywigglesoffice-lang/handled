import type { InboxBuckets, InboxBucketMessage } from "@/lib/inbox-buckets";
import type { EmailCompletionMap } from "@/lib/email-completions/types";
import { importanceInboxBoost } from "@/lib/importance-memory/score";

const PRIORITY_CATEGORIES = ["needs_attention", "quick_reply"] as const;

type MessageWithSender = InboxBucketMessage & { sender: string; internalDateMs?: number };

/**
 * Soft ordering within priority sections — important senders rise slightly,
 * low-priority sink. Does not change categories or user overrides.
 */
export function applyImportanceOrderingToBuckets<T extends MessageWithSender>(
  buckets: InboxBuckets<T>,
  completions: EmailCompletionMap,
): InboxBuckets<T> {
  const boostCache = new Map<string, number>();

  function boostFor(sender: string): number {
    if (!boostCache.has(sender)) {
      boostCache.set(
        sender,
        importanceInboxBoost({ senderLine: sender, completions }),
      );
    }
    return boostCache.get(sender) ?? 0;
  }

  function sortList(list: T[]): T[] {
    return [...list].sort((a, b) => {
      const boostDiff = boostFor(b.sender) - boostFor(a.sender);
      if (boostDiff !== 0) return boostDiff;
      return (b.internalDateMs ?? 0) - (a.internalDateMs ?? 0);
    });
  }

  const byCategory = { ...buckets.byCategory };
  for (const cat of PRIORITY_CATEGORIES) {
    const list = byCategory[cat];
    if (list?.length) {
      byCategory[cat] = sortList(list);
    }
  }

  return {
    ...buckets,
    byCategory,
    allVisible: buckets.categoryOrder.flatMap((c) => byCategory[c] ?? []),
    needsAttentionEmails: byCategory.needs_attention ?? [],
    quickReplyEmails: byCategory.quick_reply ?? [],
  };
}
