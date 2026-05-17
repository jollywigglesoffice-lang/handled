import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

/** Merge server + client rules; higher priority wins; dedupe by id. */
export function mergeInboxUserRules(
  serverRules: InboxUserRule[],
  clientRules: InboxUserRule[],
): InboxUserRule[] {
  const byId = new Map<string, InboxUserRule>();
  for (const rule of serverRules) {
    byId.set(rule.id, rule);
  }
  for (const rule of clientRules) {
    byId.set(rule.id, rule);
  }
  return [...byId.values()].sort((a, b) => b.priority - a.priority);
}
