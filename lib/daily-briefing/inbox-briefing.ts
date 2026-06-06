import { detectImportantChanges, type ImportantChange } from "@/lib/daily-briefing/important-changes";
import type { DailyBriefingMessage } from "@/lib/daily-briefing/types";
import {
  buildVisitSnapshot,
  isEmailNewSinceVisit,
  type InboxVisitSnapshot,
} from "@/lib/daily-briefing/visit-snapshot";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { getDayPhase, type DayPhase } from "@/lib/daily-rhythm";
import { estimateClearSeconds } from "@/lib/inbox-zero/estimate";

/** How the briefing is delivered today — future kinds stubbed in types. */
export type InboxBriefingScheduleKind = "on_open";

export type InboxBriefingLine = {
  id: string;
  count: number;
  label: string;
};

export type InboxBriefingCardModel = {
  schedule: { kind: InboxBriefingScheduleKind };
  greeting: string;
  hasPreviousVisit: boolean;
  sinceVisitLabel: string;
  lines: InboxBriefingLine[];
  importantChanges: ImportantChange[];
  effortSeconds: number;
  showEffort: boolean;
};

const BRIEFING_CATEGORIES: Array<{
  id: string;
  category?: InboxAiCategory;
  waitingOn?: boolean;
}> = [
  { id: "needs_attention", category: "needs_attention" },
  { id: "quick_reply", category: "quick_reply" },
  { id: "waiting_on", waitingOn: true },
  { id: "fyi", category: "fyi" },
  { id: "promotion", category: "promotion" },
];

function messageMs(m: DailyBriefingMessage): number {
  if (typeof m.internalDateMs === "number" && m.internalDateMs > 0) return m.internalDateMs;
  if (m.date) {
    const t = new Date(m.date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function countNewInCategory(
  messages: DailyBriefingMessage[],
  category: InboxAiCategory,
  snapshot: InboxVisitSnapshot | null,
): number {
  return messages.filter(
    (m) =>
      m.category === category &&
      isEmailNewSinceVisit(m.id, messageMs(m), snapshot),
  ).length;
}

function buildGreeting(
  phase: DayPhase,
  displayName: string | undefined,
  locale: "en" | "it",
): string {
  const name = displayName?.trim();
  if (locale === "it") {
    if (phase === "morning") return name ? `Buongiorno, ${name}.` : "Buongiorno.";
    if (phase === "afternoon") return name ? `Buon pomeriggio, ${name}.` : "Buon pomeriggio.";
    return name ? `Buonasera, ${name}.` : "Buonasera.";
  }
  if (phase === "morning") return name ? `Good morning, ${name}.` : "Good morning.";
  if (phase === "afternoon") return name ? `Good afternoon, ${name}.` : "Good afternoon.";
  return name ? `Good evening, ${name}.` : "Good evening.";
}

function lineLabel(
  id: string,
  count: number,
  locale: "en" | "it",
  sinceVisit: boolean,
): string {
  const n = count;
  if (locale === "it") {
    switch (id) {
      case "needs_attention":
        return sinceVisit
          ? n === 1
            ? "1 email richiede attenzione"
            : `${n} email richiedono attenzione`
          : n === 1
            ? "1 email da vedere"
            : `${n} email da vedere`;
      case "quick_reply":
        return n === 1 ? "1 risposta veloce in attesa" : `${n} risposte veloci in attesa`;
      case "waiting_on":
        return n === 1 ? "1 voce In attesa" : `${n} voci In attesa`;
      case "fyi":
        return n === 1 ? "1 email da sapere" : `${n} email da sapere`;
      case "promotion":
        return sinceVisit
          ? n === 1
            ? "1 email promozionale ricevuta"
            : `${n} email promozionali ricevute`
          : n === 1
            ? "1 promozione"
            : `${n} promozioni`;
      default:
        return `${n}`;
    }
  }

  switch (id) {
    case "needs_attention":
      return sinceVisit
        ? n === 1
          ? "1 email needs attention"
          : `${n} emails need attention`
        : n === 1
          ? "1 email needs attention"
          : `${n} emails need attention`;
    case "quick_reply":
      return n === 1 ? "1 quick reply waiting" : `${n} quick replies waiting`;
    case "waiting_on":
      return n === 1 ? "1 Waiting On item" : `${n} Waiting On items`;
    case "fyi":
      return n === 1 ? "1 good to know email" : `${n} good to know emails`;
    case "promotion":
      return sinceVisit
        ? n === 1
          ? "1 promotional email received"
          : `${n} promotional emails received`
        : n === 1
          ? "1 promotional email"
          : `${n} promotional emails`;
    default:
      return `${n}`;
  }
}

export function buildInboxBriefingCard(input: {
  locale: "en" | "it";
  displayName?: string;
  counts: Record<InboxAiCategory, number>;
  messages: DailyBriefingMessage[];
  waitingOnCount: number;
  previousSnapshot: InboxVisitSnapshot | null;
  waitingRecords: EmailCompletionRecord[];
  now?: Date;
}): InboxBriefingCardModel {
  const {
    locale,
    displayName,
    counts,
    messages,
    waitingOnCount,
    previousSnapshot,
    waitingRecords,
    now = new Date(),
  } = input;

  const hasPreviousVisit = previousSnapshot != null;
  const sinceVisit = hasPreviousVisit;

  const lines: InboxBriefingLine[] = [];
  let framingSinceVisit = sinceVisit;

  function pushLines(useSinceVisit: boolean) {
    for (const row of BRIEFING_CATEGORIES) {
      let count = 0;
      if (row.waitingOn) {
        count = waitingOnCount;
      } else if (row.category) {
        count = useSinceVisit
          ? countNewInCategory(messages, row.category, previousSnapshot)
          : counts[row.category] ?? 0;
      }
      if (count <= 0) continue;

      lines.push({
        id: row.id,
        count,
        label: lineLabel(row.id, count, locale, useSinceVisit),
      });
    }
  }

  if (sinceVisit) {
    pushLines(true);
    const hasNewInboxMail = lines.some((l) => l.id !== "waiting_on");
    if (!hasNewInboxMail) {
      lines.length = 0;
      pushLines(false);
      framingSinceVisit = false;
    }
  } else {
    pushLines(false);
  }

  const effortCounts: Record<InboxAiCategory, number> = {
    needs_attention: counts.needs_attention ?? 0,
    quick_reply: counts.quick_reply ?? 0,
    fyi: 0,
    handled: 0,
    promotion: 0,
    newsletter: 0,
  };
  const effortSeconds = estimateClearSeconds(effortCounts);

  return {
    schedule: { kind: "on_open" },
    greeting: buildGreeting(getDayPhase(now), displayName, locale),
    hasPreviousVisit: framingSinceVisit,
    sinceVisitLabel:
      locale === "it"
        ? "Dalla tua ultima visita"
        : "Since your last visit",
    lines,
    importantChanges: detectImportantChanges(messages, previousSnapshot, waitingRecords, locale),
    effortSeconds,
    showEffort: effortSeconds > 0,
  };
}

export { buildVisitSnapshot };
