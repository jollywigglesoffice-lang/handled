import {
  dailyOrientationHeadline,
  dailyRhythmSubline,
  loadingRhythmMessages,
} from "@/lib/daily-rhythm";
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

/** Calm Today headline — delegates to daily rhythm (conversations, not unread counts). */
export function calmTodayHeadline(snapshot: AttentionSnapshot, locale: AttentionLocale): string {
  return dailyOrientationHeadline(snapshot, locale);
}

/** Sparse subline — time-of-day rhythm + focus protection. */
export function pickFocusReassurance(
  snapshot: AttentionSnapshot,
  locale: AttentionLocale,
): string | null {
  return dailyRhythmSubline(snapshot, locale);
}

export { loadingRhythmMessages };

export function notUrgentSectionReassurance(
  category: "newsletter" | "promotion" | "clutter",
  count: number,
  locale: AttentionLocale,
): string {
  if (count === 0) {
    return locale === "it"
      ? "Niente di urgente qui."
      : "Nothing urgent appears here.";
  }
  if (category === "newsletter") {
    return locale === "it"
      ? "Questi aggiornamenti possono aspettare."
      : "These updates can likely wait.";
  }
  return locale === "it"
    ? "Niente di urgente qui."
    : "Nothing time-sensitive here.";
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
