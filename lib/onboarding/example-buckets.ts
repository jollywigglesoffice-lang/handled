import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";

export const MIN_ONBOARDING_EXAMPLES = 3;
export const MAX_ONBOARDING_EXAMPLES = 5;

export type OnboardingExampleBucket =
  | "important"
  | "conversation"
  | "newsletters"
  | "promotions"
  | "social";

const SOCIAL_SIGNAL =
  /\b(facebook|twitter|linkedin|instagram|slack|discord|github|mentioned you|tagged you|new follower|connection request|liked your|commented on)\b/i;
const SOCIAL_SENDER = /@(facebookmail|linkedin|twitter|instagram|slack|discord|github)\./i;

export function isConversationExample(message: Pick<GmailCardMessage, "subject" | "snippet">): boolean {
  const subject = message.subject ?? "";
  const snippet = message.snippet ?? "";
  return /^re:\s/i.test(subject) || /\breply\b/i.test(snippet) || /\bconversation\b/i.test(snippet);
}

export function isSocialNotificationExample(
  message: Pick<GmailCardMessage, "sender" | "subject" | "snippet">,
): boolean {
  const hay = `${message.sender} ${message.subject} ${message.snippet}`;
  return SOCIAL_SIGNAL.test(hay) || SOCIAL_SENDER.test(message.sender);
}

export function onboardingExampleBucket(
  message: GmailCardMessage,
): OnboardingExampleBucket | "other" {
  if (isConversationExample(message)) return "conversation";
  if (isSocialNotificationExample(message)) return "social";
  if (message.category === "newsletters") return "newsletters";
  if (message.category === "promotions") return "promotions";
  if (message.category === "worth_your_attention" || message.category === "good_to_know") {
    return "important";
  }
  return "other";
}

export const ONBOARDING_BUCKET_ROTATION: OnboardingExampleBucket[] = [
  "important",
  "conversation",
  "newsletters",
  "promotions",
  "social",
];

/** Gmail query used when the default inbox slice returns too few messages. */
export const ONBOARDING_BROAD_GMAIL_QUERY =
  "(in:inbox OR category:social OR category:promotions OR category:updates OR category:forums) newer_than:730d -in:trash -in:spam";
