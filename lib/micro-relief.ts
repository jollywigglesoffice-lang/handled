import { calmFewNeedYou, calmMostManageable, type CalmLocale } from "@/lib/calm-confidence";

export type InboxReliefInput = {
  attentionCount: number;
  handledCount: number;
  totalVisible?: number;
  locale: "en" | "it";
};

const EN = {
  manageable: "Everything else looks manageable.",
  handledRest: "The rest is set aside.",
  nothingOverdue: "Nothing important appears overdue.",
} as const;

const IT = {
  manageable: "Il resto sembra sotto controllo.",
  handledRest: "Il resto è stato messo da parte.",
  nothingOverdue: "Niente di importante sembra in ritardo.",
} as const;

function reliefStorageKey(input: InboxReliefInput): string {
  return `handled:relief:${input.attentionCount}:${input.handledCount}`;
}

/**
 * Sparse, non-repetitive calming line for the inbox header.
 * Shown at most once per count snapshot per session.
 */
export function pickInboxReliefMessage(input: InboxReliefInput): string | null {
  const { attentionCount, handledCount, totalVisible, locale } = input;
  const t = locale === "it" ? IT : EN;
  const loc = locale as CalmLocale;

  let message: string | null = null;

  if (attentionCount === 0) {
    message = calmMostManageable(loc);
  } else if (attentionCount <= 4) {
    message = calmFewNeedYou(attentionCount, loc);
  } else if (
    totalVisible &&
    totalVisible > 8 &&
    attentionCount / totalVisible <= 0.2
  ) {
    message = calmMostManageable(loc);
  } else if (handledCount >= attentionCount * 2 && handledCount >= 3) {
    message = t.manageable;
  } else if (handledCount > 0 && attentionCount <= 2) {
    message = t.handledRest;
  } else if (attentionCount <= 6 && handledCount >= 5) {
    message = t.nothingOverdue;
  }

  if (!message) return null;

  if (typeof window !== "undefined") {
    const key = reliefStorageKey(input);
    if (sessionStorage.getItem(key)) return null;
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }

  return message;
}
