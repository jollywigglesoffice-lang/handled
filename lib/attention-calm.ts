import { pickInboxReliefMessage } from "@/lib/micro-relief";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type AttentionLocale = "en" | "it";

export type AttentionSnapshot = {
  needsAttention: number;
  quickReply: number;
  handled: number;
  newsletter: number;
  promotion: number;
  clutter: number;
  totalVisible: number;
};

const EN = {
  noImmediate: "No immediate action detected.",
  onlyAttention: (n: number) =>
    n === 1
      ? "Only 1 email likely needs attention."
      : `Only ${n} emails likely need attention.`,
  quickRepliesOnly: (n: number) =>
    n === 1
      ? "1 quick reply when you have a moment."
      : `${n} quick replies when you have a moment.`,
  worthCheckingToday: "Worth checking today — the rest can safely wait.",
  canSafelyWait: "Most of these can safely wait.",
  nothingTimeSensitive: "Nothing time-sensitive appears here.",
  updatesCanWait: "These updates can likely wait.",
  filteredNoise: "Handled tucked the low-priority updates aside.",
} as const;

const IT = {
  noImmediate: "Nessuna azione immediata rilevata.",
  onlyAttention: (n: number) =>
    n === 1
      ? "Solo 1 email probabilmente richiede attenzione."
      : `Solo ${n} email probabilmente richiedono attenzione.`,
  quickRepliesOnly: (n: number) =>
    n === 1
      ? "1 risposta veloce quando hai un attimo."
      : `${n} risposte veloci quando hai un attimo.`,
  worthCheckingToday: "Da vedere oggi — il resto può aspettare.",
  canSafelyWait: "La maggior parte può aspettare tranquillamente.",
  nothingTimeSensitive: "Qui non sembra esserci nulla di urgente.",
  updatesCanWait: "Questi aggiornamenti possono probabilmente aspettare.",
  filteredNoise: "Handled ha messo da parte gli aggiornamenti a bassa priorità.",
} as const;

function t(locale: AttentionLocale) {
  return locale === "it" ? IT : EN;
}

/** Calm Today header line — never alarmist counts. */
export function calmTodayHeadline(snapshot: AttentionSnapshot, locale: AttentionLocale): string {
  const copy = t(locale);
  const { needsAttention, quickReply } = snapshot;

  if (needsAttention === 0 && quickReply === 0) {
    return copy.noImmediate;
  }
  if (needsAttention === 0 && quickReply > 0) {
    return copy.quickRepliesOnly(quickReply);
  }
  if (needsAttention <= 4) {
    return copy.onlyAttention(needsAttention);
  }
  return copy.worthCheckingToday;
}

/** Sparse secondary reassurance under Today — merges relief + focus protection. */
export function pickFocusReassurance(
  snapshot: AttentionSnapshot,
  locale: AttentionLocale,
): string | null {
  const relief = pickInboxReliefMessage({
    attentionCount: snapshot.needsAttention,
    handledCount: snapshot.handled,
    totalVisible: snapshot.totalVisible,
    locale,
  });
  if (relief) return relief;

  const copy = t(locale);
  const { needsAttention, clutter, handled, totalVisible } = snapshot;

  if (clutter >= 4 && needsAttention <= 3) {
    return copy.canSafelyWait;
  }
  if (handled >= 5 && needsAttention <= 2 && totalVisible > handled) {
    return copy.filteredNoise;
  }
  if (needsAttention === 0 && clutter > 0) {
    return copy.nothingTimeSensitive;
  }

  return null;
}

export function notUrgentSectionReassurance(
  category: "newsletter" | "promotion" | "clutter",
  count: number,
  locale: AttentionLocale,
): string {
  const copy = t(locale);
  if (count === 0) return copy.nothingTimeSensitive;
  if (category === "newsletter") return copy.updatesCanWait;
  return copy.nothingTimeSensitive;
}

/** Subtle count — avoid shouting large numbers. */
export function calmSectionCountLabel(
  count: number,
  category: InboxAiCategory,
  locale: AttentionLocale,
): string {
  if (count === 0) return "";
  if (category === "newsletter" || category === "promotion") {
    return String(count);
  }
  if (count <= 9) return String(count);
  return locale === "it" ? "alcuni" : "several";
}
