import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { parseSenderEmail } from "@/lib/inbox-user-rules/match";
import { suggestSenderAutoRuleMessage } from "@/lib/inbox-sender-onboarding";

const STORAGE_KEY = "handled_sender_correction_learning_v1";
const SUGGEST_THRESHOLD = 2;

export type SenderCorrectionRecord = {
  senderKey: string;
  displayLabel: string;
  correctionsToNeedsAttention: number;
  lastGuessedCategory?: InboxAiCategory;
  lastChosenCategory?: InboxAiCategory;
  updatedAt: number;
};

function senderKey(sender: string): string {
  const email = parseSenderEmail(sender);
  if (email) return email.toLowerCase();
  return sender.trim().toLowerCase().slice(0, 120);
}

function displayLabelFromSender(sender: string): string {
  const m = sender.match(/^["']?([^"'<]+?)["']?\s*</);
  if (m?.[1]) return m[1].trim();
  const email = parseSenderEmail(sender);
  return email?.split("@")[0] ?? sender.slice(0, 40);
}

export function loadSenderCorrectionLearning(): SenderCorrectionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SenderCorrectionRecord[]) : [];
  } catch {
    return [];
  }
}

function saveSenderCorrectionLearning(records: SenderCorrectionRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * Record when user moves mail to a higher-priority category (especially handled → needs_attention).
 */
export function recordSenderCategoryCorrection(input: {
  sender: string;
  guessedCategory: InboxAiCategory;
  chosenCategory: InboxAiCategory;
}): SenderCorrectionRecord | null {
  const priority: Record<InboxAiCategory, number> = {
    needs_attention: 4,
    quick_reply: 3,
    handled: 2,
    newsletter: 1,
    promotion: 0,
  };

  if (priority[input.chosenCategory] <= priority[input.guessedCategory]) {
    return null;
  }

  const key = senderKey(input.sender);
  const list = loadSenderCorrectionLearning();
  const existing = list.find((r) => r.senderKey === key);
  const bump =
    input.chosenCategory === "needs_attention" &&
    (input.guessedCategory === "handled" ||
      input.guessedCategory === "newsletter" ||
      input.guessedCategory === "promotion")
      ? 1
      : 0;

  const next: SenderCorrectionRecord = {
    senderKey: key,
    displayLabel: existing?.displayLabel ?? displayLabelFromSender(input.sender),
    correctionsToNeedsAttention:
      (existing?.correctionsToNeedsAttention ?? 0) + (bump || (input.chosenCategory === "needs_attention" ? 1 : 0)),
    lastGuessedCategory: input.guessedCategory,
    lastChosenCategory: input.chosenCategory,
    updatedAt: Date.now(),
  };

  const merged = [next, ...list.filter((r) => r.senderKey !== key)].slice(0, 200);
  saveSenderCorrectionLearning(merged);
  return next;
}

export function getSenderLearningSuggestion(
  sender: string,
  locale: "en" | "it" = "en",
): { message: string; senderKey: string; count: number } | null {
  const key = senderKey(sender);
  const record = loadSenderCorrectionLearning().find((r) => r.senderKey === key);
  if (!record || record.correctionsToNeedsAttention < SUGGEST_THRESHOLD) {
    return null;
  }

  return {
    senderKey: key,
    count: record.correctionsToNeedsAttention,
    message: suggestSenderAutoRuleMessage(record.displayLabel, "needs_attention", locale),
  };
}

export function clearSenderLearningSuggestion(sender: string): void {
  const key = senderKey(sender);
  saveSenderCorrectionLearning(
    loadSenderCorrectionLearning().filter((r) => r.senderKey !== key),
  );
}
