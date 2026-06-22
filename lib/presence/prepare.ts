import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxBuckets, InboxBucketMessage } from "@/lib/inbox-buckets";
import type { PresenceAdjustments } from "@/lib/presence/types";
import { scorePresenceActionable } from "@/lib/presence/score";

type MessageWithMeta = InboxBucketMessage & {
  sender: string;
  category: string;
  internalDateMs?: number;
  actionIntelligence?: GmailCardMessage["actionIntelligence"];
  autopilot?: GmailCardMessage["autopilot"];
  timeImpact?: GmailCardMessage["timeImpact"];
  timelineIntelligence?: GmailCardMessage["timelineIntelligence"];
  workflowState?: GmailCardMessage["workflowState"];
};

function sortByPresence<T extends MessageWithMeta>(
  list: T[],
  adjustments: PresenceAdjustments,
): T[] {
  return [...list].sort((a, b) => {
    const diff = scorePresenceActionable(b, adjustments) - scorePresenceActionable(a, adjustments);
    if (diff !== 0) return diff;
    return (b.internalDateMs ?? 0) - (a.internalDateMs ?? 0);
  });
}

/** Silent re-order within buckets — feels pre-prepared, never announced. */
export function applyPresenceOrderingToBuckets<T extends MessageWithMeta>(
  buckets: InboxBuckets<T>,
  adjustments: PresenceAdjustments,
): InboxBuckets<T> {
  if (!adjustments.boostActionable && !adjustments.prioritizeWaiting) {
    return buckets;
  }

  const byCategory = { ...buckets.byCategory };
  for (const cat of ["worth_your_attention", "good_to_know"] as const) {
    const list = byCategory[cat];
    if (list?.length) {
      byCategory[cat] = sortByPresence(list, adjustments);
    }
  }

  if (adjustments.sinkNewsletters) {
    for (const cat of ["newsletters", "promotions"] as const) {
      const list = byCategory[cat];
      if (list?.length) {
        byCategory[cat] = [...list].sort(
          (a, b) => (a.internalDateMs ?? 0) - (b.internalDateMs ?? 0),
        );
      }
    }
  }

  return {
    ...buckets,
    byCategory,
    allVisible: buckets.categoryOrder.flatMap((c) => byCategory[c] ?? []),
    needsAttentionEmails: byCategory.worth_your_attention ?? [],
  };
}
