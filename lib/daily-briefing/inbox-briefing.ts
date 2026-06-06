import { detectImportantChanges, type ImportantChange } from "@/lib/daily-briefing/important-changes";
import type { DailyBriefingMessage } from "@/lib/daily-briefing/types";
import {
  buildVisitSnapshot,
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
  todayLabel: string;
  lines: InboxBriefingLine[];
  importantChanges: ImportantChange[];
  effortSeconds: number;
  showEffort: boolean;
};

const BRIEFING_CATEGORIES: Array<{
  id: string;
  category?: InboxAiCategory;
  waitingOn?: boolean;
  responseReceived?: boolean;
}> = [
  { id: "needs_attention", category: "needs_attention" },
  { id: "quick_reply", category: "quick_reply" },
  { id: "response_received", responseReceived: true },
  { id: "waiting_on", waitingOn: true },
  { id: "promotion", category: "promotion" },
];

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

function lineLabel(id: string, count: number, locale: "en" | "it"): string {
  const n = count;
  if (locale === "it") {
    switch (id) {
      case "needs_attention":
        return n === 1
          ? "1 email richiede attenzione"
          : `${n} email richiedono attenzione`;
      case "quick_reply":
        return n === 1 ? "1 risposta veloce" : `${n} risposte veloci`;
      case "response_received":
        return n === 1 ? "1 risposta ricevuta" : `${n} risposte ricevute`;
      case "waiting_on":
        return n === 1 ? "1 voce in attesa" : `${n} voci in attesa`;
      case "promotion":
        return n === 1 ? "1 promozione" : `${n} promozioni`;
      default:
        return `${n}`;
    }
  }

  switch (id) {
    case "needs_attention":
      return n === 1 ? "1 email needs attention" : `${n} emails need attention`;
    case "quick_reply":
      return n === 1 ? "1 quick reply" : `${n} quick replies`;
    case "response_received":
      return n === 1 ? "1 response received" : `${n} responses received`;
    case "waiting_on":
      return n === 1 ? "1 waiting-on item" : `${n} waiting-on items`;
    case "promotion":
      return n === 1 ? "1 promotion" : `${n} promotions`;
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
  responseReceivedCount: number;
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
    responseReceivedCount,
    previousSnapshot,
    waitingRecords,
    now = new Date(),
  } = input;

  const lines: InboxBriefingLine[] = [];

  for (const row of BRIEFING_CATEGORIES) {
    let count = 0;
    if (row.waitingOn) {
      count = waitingOnCount;
    } else if (row.responseReceived) {
      count = responseReceivedCount;
    } else if (row.category) {
      count = counts[row.category] ?? 0;
    }
    if (count <= 0) continue;

    lines.push({
      id: row.id,
      count,
      label: lineLabel(row.id, count, locale),
    });
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
    todayLabel: locale === "it" ? "Oggi:" : "Today:",
    lines,
    importantChanges: detectImportantChanges(messages, previousSnapshot, waitingRecords, locale),
    effortSeconds,
    showEffort: effortSeconds > 0,
  };
}

export { buildVisitSnapshot };
