import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import {
  relationshipToProfile,
  senderMatchesRelationship,
} from "@/lib/relationship-intelligence/resolve";
import type {
  SenderRelationship,
  SenderRelationshipProfile,
} from "@/lib/relationship-intelligence/types";
import { kindToDisplayLabel } from "@/lib/relationship-intelligence/labels";

function inferFromWaitingOnLabel(waitingOn?: string): SenderRelationshipProfile | null {
  const w = waitingOn?.trim().toLowerCase();
  if (!w) return null;

  if (/\b(school|scuola|teacher|maestra)\b/.test(w)) {
    return {
      kind: "school",
      label: "School",
      importance: "important",
      source: "detected",
      confidence: 0.55,
    };
  }

  if (/\b(accountant|lawyer|client|supplier|contabile|avvocato|fornitore)\b/.test(w)) {
    return {
      kind: "client",
      label: kindToDisplayLabel("client"),
      importance: "normal",
      source: "detected",
      confidence: 0.5,
    };
  }

  return null;
}

/** Relationship tone for follow-up drafts — stored profile first, then waiting-on label. */
export function resolveRelationshipForWaiting(
  record: EmailCompletionRecord,
  stored: SenderRelationship[] = [],
): SenderRelationshipProfile | null {
  for (const rel of stored) {
    if (rel.enabled === false) continue;
    if (senderMatchesRelationship({ sender: record.sender }, rel)) {
      return relationshipToProfile(rel);
    }
  }
  return inferFromWaitingOnLabel(record.waitingOn);
}
