import type { AttentionLocale, AttentionSnapshot } from "@/lib/attention-calm";
import {
  calmFewNeedYou,
  calmNothingPressing,
  calmOpenThreads,
  type CalmLocale,
} from "@/lib/calm-confidence";
import { calmLoadingMessages } from "@/lib/calm-system-copy";
import { pickInboxReliefMessage } from "@/lib/micro-relief";

export type RhythmLocale = AttentionLocale;
export type DayPhase = "morning" | "afternoon" | "evening";

export type CompletionCopy = {
  title: string;
  subtitle: string;
  footer?: string;
};

/** Local hour bands — subtle, not timezone-perfect. */
export function getDayPhase(now = new Date()): DayPhase {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

function conversationCount(snapshot: AttentionSnapshot): number {
  return snapshot.needsAttention + snapshot.waitingOn;
}

const EN = {
  quickOnly: (n: number) =>
    n === 1
      ? "One quick reply when you have a moment."
      : `${n} quick replies when you have a moment.`,
  manageable: "Most things look manageable.",
  rhythm: {
    morning: "A calm read on what matters first.",
    afternoon: "Gentle follow-through — no rush.",
    evening: "You're allowed to be done for today.",
  },
  completion: {
    title: [
      "You're caught up enough for now.",
      "Nothing important appears unresolved right now.",
      "The rest is tucked aside for later.",
    ],
    subtitle: [
      "Step away when you want — nothing needs you right now.",
      "The inbox can rest until something actually needs you.",
      "Low-priority mail is set aside for when you want it.",
    ],
    footer: "New messages will show up when they arrive.",
  },
  loading: {
    morning: calmLoadingMessages("en"),
    afternoon: calmLoadingMessages("en"),
    evening: calmLoadingMessages("en"),
  },
} as const;

const IT = {
  quickOnly: (n: number) =>
    n === 1
      ? "Una risposta veloce quando hai un attimo."
      : `${n} risposte veloci quando hai un attimo.`,
  manageable: "La maggior parte sembra gestibile.",
  rhythm: {
    morning: "Una lettura calma di cosa conta prima.",
    afternoon: "Follow-through leggero — senza fretta.",
    evening: "Puoi chiudere la giornata quando vuoi.",
  },
  completion: {
    title: [
      "Per ora sei a posto.",
      "Niente di importante sembra irrisolto.",
      "Il resto è messo da parte per dopo.",
    ],
    subtitle: [
      "Stacca quando vuoi — niente ti serve adesso.",
      "La inbox può riposare finché non serve davvero.",
      "Il resto a bassa priorità è da parte per quando vuoi.",
    ],
    footer: "I nuovi messaggi arriveranno quando arrivano.",
  },
  loading: {
    morning: calmLoadingMessages("it"),
    afternoon: calmLoadingMessages("it"),
    evening: calmLoadingMessages("it"),
  },
} as const;

function copy(locale: RhythmLocale) {
  return locale === "it" ? IT : EN;
}

function rhythmStorageKey(
  phase: DayPhase,
  snapshot: AttentionSnapshot,
  kind: "subline" | "completion",
): string {
  return `handled:rhythm:${kind}:${phase}:${snapshot.needsAttention}:${snapshot.waitingOn}`;
}

function rememberOnce(key: string): boolean {
  if (typeof window === "undefined") return true;
  if (sessionStorage.getItem(key)) return false;
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
  return true;
}

/** Primary Today orientation — conversations, not unread counts. */
export function dailyOrientationHeadline(
  snapshot: AttentionSnapshot,
  locale: RhythmLocale,
  phase: DayPhase = getDayPhase(),
): string {
  const t = copy(locale);
  const loc = locale as CalmLocale;
  const { needsAttention, waitingOn } = snapshot;
  const conversations = conversationCount(snapshot);

  if (conversations === 0) {
    return calmNothingPressing(phase, loc);
  }
  if (needsAttention === 0 && waitingOn > 0) {
    return waitingOn === 1
      ? locale === "it"
        ? "1 email in attesa di risposta."
        : "1 email waiting on a reply."
      : locale === "it"
        ? `${waitingOn} email in attesa di risposta.`
        : `${waitingOn} emails waiting on a reply.`;
  }
  if (needsAttention <= 4) {
    return calmFewNeedYou(needsAttention, loc);
  }
  if (
    snapshot.totalVisible > 8 &&
    needsAttention / snapshot.totalVisible <= 0.25
  ) {
    return t.manageable;
  }
  return calmOpenThreads(phase, loc);
}

/** Sparse subline under Today — time-of-day + relief, once per phase per session. */
export function dailyRhythmSubline(
  snapshot: AttentionSnapshot,
  locale: RhythmLocale,
  phase: DayPhase = getDayPhase(),
): string | null {
  const relief = pickInboxReliefMessage({
    attentionCount: snapshot.needsAttention,
    handledCount: snapshot.goodToKnow,
    totalVisible: snapshot.totalVisible,
    locale,
  });
  if (relief) return relief;

  const key = rhythmStorageKey(phase, snapshot, "subline");
  if (!rememberOnce(key)) return null;

  const t = copy(locale);
  const { needsAttention, clutter, goodToKnow } = snapshot;

  if (needsAttention === 0 && clutter >= 3) {
    return locale === "it"
      ? "Il resto è aggiornamenti che possono aspettare."
      : "The rest is updates that can wait.";
  }
  if (goodToKnow >= 4 && needsAttention <= 2) {
    return locale === "it"
      ? "Il resto è stato messo da parte."
      : "The rest has been set aside.";
  }

  return t.rhythm[phase];
}

/** Healthy completion when the attention queue is clear — no gamification. */
export function healthyCompletionState(
  locale: RhythmLocale,
  phase: DayPhase = getDayPhase(),
): CompletionCopy {
  const t = copy(locale);
  const idx =
    phase === "morning" ? 0 : phase === "afternoon" ? 1 : 2;

  return {
    title: t.completion.title[idx]!,
    subtitle: t.completion.subtitle[idx]!,
    footer: t.completion.footer,
  };
}

/** Rotating loading whispers matched to time of day. */
export function loadingRhythmMessages(
  locale: RhythmLocale,
  phase: DayPhase = getDayPhase(),
): string[] {
  return [...copy(locale).loading[phase]];
}
