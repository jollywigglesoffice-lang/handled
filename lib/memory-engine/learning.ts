/** Trust and reply likelihood for personal memory learning. */

export function trustScoreFromCorrections(correctionCount: number): number {
  return Math.min(1, 0.25 + correctionCount * 0.2);
}

export function meetsAutoApplyTrust(trustScore: number): boolean {
  return trustScore >= 0.55;
}

/** Reply actions increase likelihood; passive/archive decrease it. */
const REPLY_ACTIONS = new Set([
  "replied",
  "worth_your_attention",
  "sent_reply",
  "waiting_on_someone",
]);

const PASSIVE_ACTIONS = new Set([
  "no_action_needed",
  "saved_for_reference",
  "archived",
  "good_to_know",
  "ignored",
]);

export function replyLikelihoodFromCounts(input: {
  replyCount: number;
  passiveCount: number;
  total: number;
}): number {
  if (input.total <= 0) return 0;
  const raw = (input.replyCount - input.passiveCount * 0.5) / input.total;
  return Math.max(0, Math.min(1, raw));
}

export function isReplyAction(actionId: string): boolean {
  return REPLY_ACTIONS.has(actionId);
}

export function isPassiveAction(actionId: string): boolean {
  return PASSIVE_ACTIONS.has(actionId);
}

export function feedbackAreaTag(category: string): string {
  switch (category) {
    case "wrong_category":
      return "classification";
    case "missing_email":
      return "missing_email";
    case "ux_confusion":
      return "ui";
    case "bug":
      return "bug";
    default:
      return "other";
  }
}

export function extractEmailIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/emails\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
