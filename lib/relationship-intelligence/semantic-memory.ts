import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { parseSenderEmail } from "@/lib/inbox-user-rules/match";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
import { kindToDisplayLabel } from "@/lib/relationship-intelligence/labels";
import type { RelationshipKind, SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export type SemanticEntityHint = {
  pattern: RegExp;
  kind: RelationshipKind;
  label: string;
  source: "default" | "user_relationship" | "user_keyword";
};

/** Built-in examples — extend via settings relationships & keyword rules. */
const DEFAULT_ENTITY_HINTS: SemanticEntityHint[] = [
  { pattern: /\balexandria\b/i, kind: "school", label: "School", source: "default" },
  { pattern: /\bseba(?:stiano)?\b/i, kind: "family", label: "Family", source: "default" },
  { pattern: /\bscuola\b/i, kind: "school", label: "School", source: "default" },
  { pattern: /\binsegnante|maestra|maestro|colloquio\b/i, kind: "school", label: "School", source: "default" },
  { pattern: /\bpediatra|ospedale\b/i, kind: "healthcare", label: "Healthcare", source: "default" },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function senderDisplayTokens(sender: string): string[] {
  const tokens: string[] = [];
  const fromQuoted = sender.match(/^["']?([^"'<]+?)["']?\s*</);
  if (fromQuoted?.[1]) {
    for (const part of fromQuoted[1].trim().split(/\s+/)) {
      if (part.length >= 3) tokens.push(part);
    }
  }
  const email = parseSenderEmail(sender);
  if (email) {
    const local = email.split("@")[0];
    if (local.length >= 3) tokens.push(local);
  }
  return tokens;
}

/** Build hints from saved sender relationships (e.g. Alexandria marked as School). */
export function hintsFromSenderRelationships(
  relationships: SenderRelationship[],
): SemanticEntityHint[] {
  const hints: SemanticEntityHint[] = [];
  for (const rel of relationships) {
    if (rel.enabled === false) continue;
    if (!["school", "family", "healthcare", "vip_client"].includes(rel.relationshipKind)) {
      continue;
    }
    const label = rel.displayLabel || kindToDisplayLabel(rel.relationshipKind);
    if (rel.senderEmail) {
      hints.push({
        pattern: new RegExp(`\\b${escapeRegex(rel.senderEmail)}\\b`, "i"),
        kind: rel.relationshipKind,
        label,
        source: "user_relationship",
      });
    }
    const tokens = senderDisplayTokens(rel.senderEmail || rel.senderDomain);
    for (const t of tokens) {
      if (t.length < 4) continue;
      hints.push({
        pattern: new RegExp(`\\b${escapeRegex(t)}\\b`, "i"),
        kind: rel.relationshipKind,
        label,
        source: "user_relationship",
      });
    }
  }
  return hints;
}

export function matchSemanticMemory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  relationships: SenderRelationship[] = [],
): SenderRelationshipProfile | null {
  const hay = `${row.sender} ${row.subject} ${row.snippet ?? ""}`;
  const hints = [...DEFAULT_ENTITY_HINTS, ...hintsFromSenderRelationships(relationships)];

  for (const hint of hints) {
    if (hint.pattern.test(hay) || hint.pattern.test(row.sender)) {
      const importance =
        hint.kind === "vip_client"
          ? "vip"
          : hint.kind === "school" || hint.kind === "family" || hint.kind === "healthcare"
            ? "important"
            : "normal";
      return {
        kind: hint.kind,
        label: hint.label as SenderRelationshipProfile["label"],
        importance,
        source: "detected",
        confidence: hint.source === "user_relationship" ? 0.95 : 0.85,
      };
    }
  }

  return null;
}

export function semanticForcedCategory(
  profile: SenderRelationshipProfile | null,
): InboxAiCategory | null {
  if (!profile) return null;
  if (profile.importance === "ignore") return null;
  if (["school", "family", "healthcare", "vip_client"].includes(profile.kind)) {
    return "worth_your_attention";
  }
  if (profile.importance === "vip" || profile.importance === "important") {
    return "worth_your_attention";
  }
  return null;
}
