export type InboxReliefInput = {
  attentionCount: number;
  handledCount: number;
  totalVisible?: number;
  locale: "en" | "it";
};

const EN = {
  onlyAttention: (n: number) =>
    n === 1
      ? "Only 1 email likely needs your attention."
      : `Only ${n} emails likely need your attention.`,
  manageable: "Everything else looks manageable.",
  mostManageable: "Most of your inbox appears manageable.",
  handledRest: "Handled took care of the rest.",
  quietInbox: "Everything looks manageable right now.",
  nothingOverdue: "Nothing important appears overdue.",
} as const;

const IT = {
  onlyAttention: (n: number) =>
    n === 1
      ? "Solo 1 email probabilmente richiede attenzione."
      : `Solo ${n} email probabilmente richiedono attenzione.`,
  manageable: "Il resto sembra sotto controllo.",
  mostManageable: "La maggior parte della inbox sembra gestibile.",
  handledRest: "Handled ha gestito il resto.",
  quietInbox: "Tutto sembra gestibile adesso.",
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

  let message: string | null = null;

  if (attentionCount === 0) {
    message = t.quietInbox;
  } else if (attentionCount <= 4) {
    message = t.onlyAttention(attentionCount);
  } else if (
    totalVisible &&
    totalVisible > 8 &&
    attentionCount / totalVisible <= 0.2
  ) {
    message = t.mostManageable;
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
