import type { SenderRule } from "@/lib/sender-rules/types";

export const SETUP_SQL = "supabase/sql/sender_rules.sql";

export function isSenderRulesTableMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("sender_rules") &&
    (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache"))
  );
}

export function rowToSenderRule(row: {
  id: string;
  sender_email: string;
  sender_domain: string;
  target_category: string;
  label: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}): SenderRule {
  return {
    id: row.id,
    senderEmail: row.sender_email ?? "",
    senderDomain: row.sender_domain ?? "",
    targetCategory: row.target_category as SenderRule["targetCategory"],
    label: row.label ?? undefined,
    enabled: row.enabled ?? true,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function senderRuleToRow(userId: string, rule: SenderRule) {
  return {
    id: rule.id,
    user_id: userId,
    sender_email: rule.senderEmail,
    sender_domain: rule.senderDomain,
    target_category: rule.targetCategory,
    label: rule.label ?? null,
    enabled: rule.enabled,
    updated_at: new Date(rule.updatedAt).toISOString(),
    created_at: new Date(rule.createdAt).toISOString(),
  };
}
