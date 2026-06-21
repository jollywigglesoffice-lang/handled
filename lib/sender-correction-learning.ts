import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { coerceLegacyInboxCategory } from "@/lib/inbox-ai-categories";
import { resolveSenderIdentity } from "@/lib/sender-identity";
import { suggestSenderAutoRuleMessage } from "@/lib/inbox-sender-onboarding";

const STORAGE_KEY = "handled_sender_correction_learning_v1";
const AUTO_LEARN_THRESHOLD = 2;

export type SenderCorrectionRecord = {
  senderKey: string;
  displayLabel: string;
  correctionsToNeedsAttention: number;
  /** Count of manual corrections per chosen category (for quiet sender learning). */
  categoryCounts: Partial<Record<InboxAiCategory, number>>;
  lastGuessedCategory?: InboxAiCategory;
  lastChosenCategory?: InboxAiCategory;
  updatedAt: number;
};

function senderKey(sender: string): string {
  return resolveSenderIdentity(sender).ruleKey.slice(0, 120);
}

function displayLabelFromSender(sender: string): string {
  const identity = resolveSenderIdentity(sender);
  return identity.displayName || identity.email.split("@")[0] || sender.slice(0, 40);
}

function normalizeRecord(raw: Partial<SenderCorrectionRecord>): SenderCorrectionRecord {
  return {
    senderKey: raw.senderKey ?? "",
    displayLabel: raw.displayLabel ?? "",
    correctionsToNeedsAttention: raw.correctionsToNeedsAttention ?? 0,
    categoryCounts: raw.categoryCounts ?? {},
    lastGuessedCategory: raw.lastGuessedCategory,
    lastChosenCategory: raw.lastChosenCategory,
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

export function loadSenderCorrectionLearning(): SenderCorrectionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => normalizeRecord(r as Partial<SenderCorrectionRecord>));
  } catch {
    return [];
  }
}

function saveSenderCorrectionLearning(records: SenderCorrectionRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * Record a manual category correction (any direction).
 * Returns the updated record when the sender may be ready for quiet auto-learning.
 */
export function recordSenderCategoryCorrection(input: {
  sender: string;
  guessedCategory: InboxAiCategory;
  chosenCategory: InboxAiCategory;
  accountId?: string;
}): SenderCorrectionRecord | null {
  if (input.guessedCategory === input.chosenCategory) return null;

  const base = senderKey(input.sender);
  const key = input.accountId ? `${input.accountId}::${base}` : base;
  const list = loadSenderCorrectionLearning();
  const existing = list.find((r) => r.senderKey === key);
  const categoryCounts = { ...(existing?.categoryCounts ?? {}) };
  categoryCounts[input.chosenCategory] = (categoryCounts[input.chosenCategory] ?? 0) + 1;

  const bump =
    input.chosenCategory === "worth_your_attention" &&
    (coerceLegacyInboxCategory(input.guessedCategory) === "good_to_know" ||
      input.guessedCategory === "newsletters" ||
      input.guessedCategory === "promotions")
      ? 1
      : 0;

  const next: SenderCorrectionRecord = {
    senderKey: key,
    displayLabel: existing?.displayLabel ?? displayLabelFromSender(input.sender),
    correctionsToNeedsAttention:
      (existing?.correctionsToNeedsAttention ?? 0) +
      (bump || (input.chosenCategory === "worth_your_attention" ? 1 : 0)),
    categoryCounts,
    lastGuessedCategory: input.guessedCategory,
    lastChosenCategory: input.chosenCategory,
    updatedAt: Date.now(),
  };

  const merged = [next, ...list.filter((r) => r.senderKey !== key)].slice(0, 200);
  saveSenderCorrectionLearning(merged);
  return next;
}

/** After repeated corrections to the same category, apply a sender rule quietly. */
export function shouldAutoLearnSenderRule(
  record: SenderCorrectionRecord | null,
  chosenCategory: InboxAiCategory,
): boolean {
  if (!record) return false;
  return (record.categoryCounts[chosenCategory] ?? 0) >= AUTO_LEARN_THRESHOLD;
}

export function getSenderLearningSuggestion(
  sender: string,
  locale: "en" | "it" = "en",
): { message: string; senderKey: string; count: number } | null {
  const key = senderKey(sender);
  const record = loadSenderCorrectionLearning().find((r) => r.senderKey === key);
  if (!record || record.correctionsToNeedsAttention < AUTO_LEARN_THRESHOLD) {
    return null;
  }

  return {
    senderKey: key,
    count: record.correctionsToNeedsAttention,
    message: suggestSenderAutoRuleMessage(record.displayLabel, "worth_your_attention", locale),
  };
}

export function clearSenderLearningSuggestion(sender: string): void {
  const key = senderKey(sender);
  saveSenderCorrectionLearning(
    loadSenderCorrectionLearning().filter((r) => r.senderKey !== key),
  );
}
