import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  inboxCategoryLearnPriority,
  type InboxAiCategory,
} from "@/lib/inbox-ai-categories";
import { parseSenderDomain, parseSenderEmail } from "@/lib/inbox-user-rules/match";
import type { CategorizationReasonCode } from "@/lib/categorization-intelligence/types";

export type SenderMemoryHit = {
  boost: number;
  penalty: number;
  reasonCodes: CategorizationReasonCode[];
  reasonLabels: string[];
  suggestedCategory?: InboxAiCategory;
};

type SenderMemoryRule = {
  senderEmail?: string;
  senderDomain?: string;
  targetCategory: InboxAiCategory;
};

function senderMatches(row: Pick<GmailInboxRow, "sender">, rule: SenderMemoryRule): boolean {
  const email = parseSenderEmail(row.sender)?.toLowerCase();
  const domain = parseSenderDomain(row.sender)?.toLowerCase();
  if (rule.senderEmail && email && email === rule.senderEmail.toLowerCase()) return true;
  if (rule.senderDomain && domain && domain === rule.senderDomain.toLowerCase()) return true;
  if (rule.senderEmail && row.sender.toLowerCase().includes(rule.senderEmail.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * Soft sender memory from learned rules and relationships.
 * Hard force rules are applied earlier in the pipeline; this adds score boosts.
 */
export function applySenderMemory(
  row: GmailInboxRow,
  rules: SenderMemoryRule[],
  relationship?: { kind?: string | null; importance?: string | null },
): SenderMemoryHit {
  const reasonCodes: CategorizationReasonCode[] = [];
  const reasonLabels: string[] = [];
  let boost = 0;
  let penalty = 0;
  let suggestedCategory: InboxAiCategory | undefined;

  for (const rule of rules) {
    if (!senderMatches(row, rule)) continue;
    const pri = inboxCategoryLearnPriority(rule.targetCategory);
    if (pri >= inboxCategoryLearnPriority("needs_attention")) {
      boost += 18 + pri * 4;
      reasonCodes.push("known_high_priority_sender");
      reasonLabels.push(`Known high-priority sender → ${rule.targetCategory.replace(/_/g, " ")}`);
      suggestedCategory = rule.targetCategory;
    } else if (pri <= inboxCategoryLearnPriority("handled")) {
      penalty += 12;
      reasonCodes.push("known_low_priority_sender");
      reasonLabels.push(`Known low-priority sender → ${rule.targetCategory.replace(/_/g, " ")}`);
    }
  }

  const kind = relationship?.kind ?? "";
  const importance = relationship?.importance ?? "";
  if (kind === "school" || kind === "family" || kind === "healthcare") {
    boost += 22;
    reasonCodes.push(
      kind === "school"
        ? "relationship_school"
        : kind === "family"
          ? "relationship_family"
          : "relationship_healthcare",
    );
    reasonLabels.push(`Relationship: ${kind}`);
    suggestedCategory = "needs_attention";
  }
  if (importance === "vip" || importance === "important" || kind === "vip_client") {
    boost += 16;
    reasonCodes.push("relationship_vip");
    reasonLabels.push("VIP / important contact");
    suggestedCategory = "needs_attention";
  }

  return { boost, penalty, reasonCodes, reasonLabels, suggestedCategory };
}
