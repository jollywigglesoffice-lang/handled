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
  activeWaiting?: boolean;
  responseReceived?: boolean;
}> = [
  { id: "worth_your_attention", category: "worth_your_attention" },
  { id: "active_waiting", activeWaiting: true },
  { id: "response_received", responseReceived: true },
  { id: "good_to_know", category: "good_to_know" },
  { id: "promotions", category: "promotions" },
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
      case "worth_your_attention":
        return n === 1
          ? "1 email richiede attenzione"
          : `${n} email richiedono attenzione`;
      case "active_waiting":
        return n === 1 ? "1 email in attesa" : `${n} email in attesa`;
      case "response_received":
        return n === 1 ? "1 risposta ricevuta" : `${n} risposte ricevute`;
      case "good_to_know":
        return n === 1 ? "1 da sapere" : `${n} da sapere`;
      case "promotions":
        return n === 1 ? "1 promozione" : `${n} promozioni`;
      default:
        return `${n}`;
    }
  }

  switch (id) {
    case "worth_your_attention":
      return n === 1 ? "1 email needs attention" : `${n} emails need attention`;
    case "active_waiting":
      return n === 1 ? "1 waiting on someone" : `${n} waiting on someone`;
    case "response_received":
      return n === 1 ? "1 response received" : `${n} responses received`;
    case "good_to_know":
      return n === 1 ? "1 good to know" : `${n} good to know`;
    case "promotions":
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
    if (row.activeWaiting) {
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

  const effortSeconds = estimateClearSeconds(counts);

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
