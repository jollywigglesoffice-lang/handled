import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

const MIN_EMAILS = 3;
const MAX_EMAILS = 5;

const PRIORITY: InboxAiCategory[] = ["worth_your_attention"];

/** Pick a short guided queue — does not remove mail from the inbox, only selects a view subset. */
export function buildFirstTimeOnboardingQueue(
  messages: GmailCardMessage[],
  isCompleted: (id: string) => boolean,
): GmailCardMessage[] {
  const candidates = messages.filter((m) => !isCompleted(m.id));
  if (candidates.length === 0) return [];

  const seen = new Set<string>();
  const picked: GmailCardMessage[] = [];

  for (const category of PRIORITY) {
    for (const message of candidates) {
      if (message.category !== category || seen.has(message.id)) continue;
      seen.add(message.id);
      picked.push(message);
      if (picked.length >= MAX_EMAILS) return picked;
    }
  }

  for (const message of candidates) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    picked.push(message);
    if (picked.length >= MAX_EMAILS) break;
  }

  if (picked.length < MIN_EMAILS && picked.length < candidates.length) {
    for (const message of candidates) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      picked.push(message);
      if (picked.length >= MIN_EMAILS || picked.length >= MAX_EMAILS) break;
    }
  }

  return picked.slice(0, MAX_EMAILS);
}
