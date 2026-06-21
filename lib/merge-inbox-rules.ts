import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import { safeArray } from "@/lib/safe-array";

/** Merge server + client rules; higher priority wins; dedupe by id. */
export function mergeInboxUserRules(
  serverRules: InboxUserRule[] | null | undefined,
  clientRules: InboxUserRule[] | null | undefined,
): InboxUserRule[] {
  const byId = new Map<string, InboxUserRule>();
  for (const rule of safeArray(serverRules)) {
    byId.set(rule.id, rule);
  }
  for (const rule of safeArray(clientRules)) {
    byId.set(rule.id, rule);
  }
  return [...byId.values()].sort((a, b) => b.priority - a.priority);
}
