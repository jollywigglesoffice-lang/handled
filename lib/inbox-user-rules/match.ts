import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxRuleMatch, InboxUserRule } from "@/lib/inbox-user-rules/types";

function normalizePattern(value: string): string {
  return value.trim().toLowerCase();
}

export function parseSenderEmail(sender: string): string {
  const angle = sender.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  if (sender.includes("@")) return sender.trim().toLowerCase();
  return "";
}

export function parseSenderDomain(sender: string): string {
  const email = parseSenderEmail(sender);
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1);
}

export function ruleMatchesRow(row: GmailInboxRow, match: InboxRuleMatch): boolean {
  const sender = row.sender ?? "";
  const senderLower = sender.toLowerCase();
  const email = parseSenderEmail(sender);
  const domain = parseSenderDomain(sender);
  const subject = (row.subject ?? "").toLowerCase();
  const pattern = normalizePattern(
    match.type === "sender_email" ||
      match.type === "sender_domain" ||
      match.type === "sender_contains" ||
      match.type === "subject_contains"
      ? match.value
      : "",
  );

  if (!pattern) return false;

  switch (match.type) {
    case "sender_email":
      return email === pattern || email.endsWith(`@${pattern}`);
    case "sender_domain":
      return domain === pattern || domain.endsWith(`.${pattern}`);
    case "sender_contains":
      return senderLower.includes(pattern) || email.includes(pattern);
    case "subject_contains":
      return subject.includes(pattern);
    default:
      return false;
  }
}

export function sortRulesForPhase(rules: InboxUserRule[], phase: InboxUserRule["phase"]): InboxUserRule[] {
  return rules
    .filter((r) => r.enabled && r.phase === phase)
    .sort((a, b) => b.priority - a.priority);
}

export function findFirstMatchingRule(
  row: GmailInboxRow,
  rules: InboxUserRule[],
  phase: InboxUserRule["phase"],
): InboxUserRule | null {
  for (const rule of sortRulesForPhase(rules, phase)) {
    if (ruleMatchesRow(row, rule.match)) return rule;
  }
  return null;
}
