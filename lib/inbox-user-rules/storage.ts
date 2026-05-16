import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type InboxRulesStorageMode = "inbox_rules_table" | "users_json_column" | "none";

export function isInboxRulesTableMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("inbox_rules") &&
    (m.includes("schema cache") ||
      m.includes("does not exist") ||
      m.includes("could not find the table") ||
      m.includes("relation") ||
      m.includes("pgrst205"))
  );
}

export function parseRulesJson(value: unknown): InboxUserRule[] {
  if (!Array.isArray(value)) return [];
  return value as InboxUserRule[];
}
