import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import { safeArray } from "@/lib/safe-array";

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

export function isUsersJsonColumnMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("inbox_rules_json") &&
    (m.includes("schema cache") ||
      m.includes("could not find") ||
      m.includes("does not exist") ||
      m.includes("column") ||
      m.includes("pgrst"))
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureUuidRuleIds(rules: InboxUserRule[] | null | undefined): InboxUserRule[] {
  return safeArray(rules).map((rule) => {
    if (UUID_RE.test(rule.id)) return rule;
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return { ...rule, id: crypto.randomUUID() };
    }
    return { ...rule, id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
  });
}

export function parseRulesJson(value: unknown): InboxUserRule[] {
  if (!Array.isArray(value)) return [];
  return value as InboxUserRule[];
}
