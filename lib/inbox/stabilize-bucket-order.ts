import type { InboxBuckets } from "@/lib/inbox-buckets";
import { logEmailSelectionChange } from "@/lib/email-selection/debug";

type OrderedIds = Record<string, string[]>;

/** Preserve per-category email order after the first presence/intelligence pass. */
export function stabilizeBucketOrder<T extends { id: string; category: string }>(
  incoming: InboxBuckets<T>,
  frozenOrderRef: { current: OrderedIds | null },
  lockOrdering: boolean,
): InboxBuckets<T> {
  if (!lockOrdering) {
    return incoming;
  }

  if (!frozenOrderRef.current) {
    const order: OrderedIds = {};
    for (const cat of incoming.categoryOrder) {
      order[cat] = (incoming.byCategory[cat] ?? []).map((m) => m.id);
    }
    frozenOrderRef.current = order;
    logEmailSelectionChange({
      context: "inbox_list",
      trigger: "system",
      functionName: "stabilizeBucketOrder",
      component: "emails-client",
      previousEmailId: null,
      nextEmailId: null,
      reason: "initial_presence_order_locked",
    });
    return incoming;
  }

  const byCategory = { ...incoming.byCategory };
  for (const cat of incoming.categoryOrder) {
    const list = incoming.byCategory[cat] ?? [];
    const frozenIds = frozenOrderRef.current[cat];
    if (!frozenIds?.length) {
      byCategory[cat] = list;
      continue;
    }

    const byId = new Map(list.map((m) => [m.id, m] as const));
    const reordered: T[] = [];
    for (const id of frozenIds) {
      const row = byId.get(id);
      if (row) {
        reordered.push(row);
        byId.delete(id);
      }
    }
    for (const row of byId.values()) {
      reordered.push(row);
    }
    byCategory[cat] = reordered;
  }

  return {
    ...incoming,
    byCategory,
    allVisible: incoming.categoryOrder.flatMap((c) => byCategory[c] ?? []),
    needsAttentionEmails: byCategory.worth_your_attention ?? [],
  };
}

export function resetStabilizedBucketOrder(frozenOrderRef: { current: OrderedIds | null }): void {
  frozenOrderRef.current = null;
}
