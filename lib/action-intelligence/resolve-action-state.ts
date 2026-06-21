import type { ImpliedActionKind } from "@/lib/action-intelligence/types";
import type { EmailActionState } from "@/lib/action-intelligence/types";
import {
  hasExplicitActionTrigger,
  isAnnouncementEmail,
  rowHaystack,
} from "@/lib/explicit-email-signals";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

const PASSIVE_CONFIDENCE_CEILING = 0.72;

const INFORMATIONAL_CATEGORIES: ReadonlySet<string> = new Set([
  "promotions",
  "newsletters",
  "good_to_know",
  "good_to_know",
]);

const WAITING_KINDS: ReadonlySet<ImpliedActionKind> = new Set([
  "waiting_on_them",
  "waiting_on_you",
  "follow_up",
]);

export type ResolveActionStateInput = {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  extraBody?: string;
  category?: InboxAiCategory;
  implied: ImpliedActionKind[];
  heuristicActionable: boolean;
  confidence: number;
};

function isInformationalEmail(hay: string, category?: InboxAiCategory): boolean {
  if (isAnnouncementEmail(hay)) return true;
  if (category && INFORMATIONAL_CATEGORIES.has(category)) return true;
  return false;
}

/**
 * Tri-state action posture: actionable, waiting_response, or passive.
 * Low confidence or informational mail → passive (no forced action).
 */
export function resolveEmailActionState(input: ResolveActionStateInput): EmailActionState {
  const hay = rowHaystack(input.row, input.extraBody);
  const explicit = hasExplicitActionTrigger(input.row, input.extraBody);
  const informational = isInformationalEmail(hay, input.category);
  const hasWaitingSignal = input.implied.some((k) => WAITING_KINDS.has(k));

  if (
    hasWaitingSignal &&
    input.heuristicActionable &&
    explicit &&
    input.confidence >= 0.6
  ) {
    return "waiting_response";
  }

  if (
    input.heuristicActionable &&
    explicit &&
    input.confidence >= PASSIVE_CONFIDENCE_CEILING &&
    !informational
  ) {
    return "actionable";
  }

  return "passive";
}
