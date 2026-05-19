import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { parseSenderDomain, parseSenderEmail } from "@/lib/inbox-user-rules/match";
import { detectRelationshipFromMessage } from "@/lib/relationship-intelligence/detect";
import { MANUAL_RELATIONSHIP_PRESETS } from "@/lib/relationship-intelligence/labels";
import type {
  SenderRelationship,
  SenderRelationshipProfile,
} from "@/lib/relationship-intelligence/types";

export function senderMatchesRelationship(
  row: Pick<GmailInboxRow, "sender">,
  rel: Pick<SenderRelationship, "senderEmail" | "senderDomain">,
): boolean {
  const email = parseSenderEmail(row.sender);
  const domain = parseSenderDomain(row.sender);
  if (rel.senderEmail && email && email === rel.senderEmail.toLowerCase()) return true;
  if (rel.senderDomain && domain && domain === rel.senderDomain.toLowerCase()) return true;
  if (rel.senderEmail && row.sender.toLowerCase().includes(rel.senderEmail.toLowerCase())) {
    return true;
  }
  return false;
}

export function relationshipToProfile(rel: SenderRelationship): SenderRelationshipProfile {
  return {
    kind: rel.relationshipKind,
    label: rel.displayLabel,
    importance: rel.importance,
    source: rel.source === "category_rule" ? "manual" : rel.source,
    confidence: rel.confidence,
  };
}

/**
 * Resolve relationship: manual store wins, then heuristics.
 */
export function resolveSenderRelationship(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
  stored: SenderRelationship[],
): SenderRelationshipProfile | null {
  for (const rel of stored) {
    if (rel.enabled === false) continue;
    if (senderMatchesRelationship(row, rel)) {
      return relationshipToProfile(rel);
    }
  }

  return detectRelationshipFromMessage(row, category);
}

export function relationshipFromPreset(
  presetId: string,
  sender: string,
): SenderRelationship | null {
  const preset = MANUAL_RELATIONSHIP_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  const senderEmail = parseSenderEmail(sender) || sender.trim().toLowerCase();
  const senderDomain = parseSenderDomain(sender);
  const now = Date.now();

  return {
    id: `rel-${now}`,
    senderEmail,
    senderDomain,
    relationshipKind: preset.kind,
    importance: preset.importance,
    displayLabel: preset.label,
    source: "manual",
    confidence: 1,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}
