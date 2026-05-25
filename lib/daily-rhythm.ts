import type { AttentionLocale, AttentionSnapshot } from "@/lib/attention-calm";
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
  return snapshot.needsAttention + snapshot.quickReply;
}

const EN = {
  nothingUrgent: {
    morning: "Nothing urgent appears waiting today.",
    afternoon: "Nothing urgent appears waiting.",
    evening: "Nothing urgent appears waiting tonight.",
  },
  onlyToday: (n: number) =>
    n === 1
      ? "Only 1 conversation likely needs attention today."
      : `Only ${n} conversations likely need attention today.`,
  quickOnly: (n: number) =>
    n === 1
      ? "One quick reply when you have a moment."
      : `${n} quick replies when you have a moment.`,
  worthToday: {
    morning: "A few conversations worth your attention today — the rest can wait.",
    afternoon: "A few conversations to tend to — most of the rest can wait.",
    evening: "A few open threads — nothing that can't wait until tomorrow.",
  },
  manageable: "Most of your inbox looks manageable.",
  rhythm: {
    morning: "A calm read on what matters first.",
    afternoon: "Gentle follow-through — no rush.",
    evening: "You're allowed to be done for today.",
  },
  completion: {
    title: [
      "You're caught up enough for now.",
      "Nothing important appears unresolved right now.",
      "Handled took care of the noise.",
    ],
    subtitle: [
      "Step away when you want — Handled will be here.",
      "The inbox can rest until something actually needs you.",
      "Low-priority mail is tucked away for later.",
    ],
    footer: "New messages will show up when they arrive.",
  },
  loading: {
    morning: [
      "Preparing your day…",
      "Seeing what matters first…",
      "Getting things organized…",
    ],
    afternoon: [
      "Checking what still needs you…",
      "Keeping things organized…",
      "Almost ready…",
    ],
    evening: [
      "A last calm look…",
      "Sorting what can wait…",
      "Almost ready…",
    ],
  },
} as const;

const IT = {
  nothingUrgent: {
    morning: "Niente di urgente in attesa oggi.",
    afternoon: "Niente di urgente in attesa.",
    evening: "Niente di urgente in attesa stasera.",
  },
  onlyToday: (n: number) =>
    n === 1
      ? "Solo 1 conversazione probabilmente richiede attenzione oggi."
      : `Solo ${n} conversazioni probabilmente richiedono attenzione oggi.`,
  quickOnly: (n: number) =>
    n === 1
      ? "Una risposta veloce quando hai un attimo."
      : `${n} risposte veloci quando hai un attimo.`,
  worthToday: {
    morning: "Qualche conversazione oggi — il resto può aspettare.",
    afternoon: "Qualche conversazione da seguire — il resto può aspettare.",
    evening: "Qualche thread aperto — può aspettare fino a domani.",
  },
  manageable: "La maggior parte della inbox sembra gestibile.",
  rhythm: {
    morning: "Una lettura calma di cosa conta prima.",
    afternoon: "Follow-through leggero — senza fretta.",
    evening: "Puoi chiudere la giornata quando vuoi.",
  },
  completion: {
    title: [
      "Per ora sei a posto.",
      "Niente di importante sembra irrisolto.",
      "Handled ha filtrato il rumore.",
    ],
    subtitle: [
      "Stacca quando vuoi — Handled resta qui.",
      "La inbox può riposare finché non serve davvero.",
      "Il resto a bassa priorità è messo da parte.",
    ],
    footer: "I nuovi messaggi arriveranno quando arrivano.",
  },
  loading: {
    morning: [
      "Preparo la giornata…",
      "Vedo cosa conta prima…",
      "Metto tutto in ordine…",
    ],
    afternoon: [
      "Controllo cosa serve ancora…",
      "Tengo tutto in ordine…",
      "Quasi pronto…",
    ],
    evening: [
      "Un ultimo sguardo calmo…",
      "Ordino cosa può aspettare…",
      "Quasi pronto…",
    ],
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
  return `handled:rhythm:${kind}:${phase}:${snapshot.needsAttention}:${snapshot.quickReply}`;
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
  const { needsAttention, quickReply } = snapshot;
  const conversations = conversationCount(snapshot);

  if (conversations === 0) {
    return t.nothingUrgent[phase];
  }
  if (needsAttention === 0 && quickReply > 0) {
    return t.quickOnly(quickReply);
  }
  if (needsAttention <= 4) {
    return t.onlyToday(needsAttention);
  }
  if (
    snapshot.totalVisible > 8 &&
    needsAttention / snapshot.totalVisible <= 0.25
  ) {
    return t.manageable;
  }
  return t.worthToday[phase];
}

/** Sparse subline under Today — time-of-day + relief, once per phase per session. */
export function dailyRhythmSubline(
  snapshot: AttentionSnapshot,
  locale: RhythmLocale,
  phase: DayPhase = getDayPhase(),
): string | null {
  const relief = pickInboxReliefMessage({
    attentionCount: snapshot.needsAttention,
    handledCount: snapshot.handled,
    totalVisible: snapshot.totalVisible,
    locale,
  });
  if (relief) return relief;

  const key = rhythmStorageKey(phase, snapshot, "subline");
  if (!rememberOnce(key)) return null;

  const t = copy(locale);
  const { needsAttention, clutter, handled } = snapshot;

  if (needsAttention === 0 && clutter >= 3) {
    return locale === "it"
      ? "Il resto è aggiornamenti che possono aspettare."
      : "The rest is updates that can wait.";
  }
  if (handled >= 4 && needsAttention <= 2) {
    return locale === "it"
      ? "Handled ha messo da parte il rumore."
      : "Handled tucked the noise aside.";
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
