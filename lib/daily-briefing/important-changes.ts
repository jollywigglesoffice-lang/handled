import { detectMessageBriefingSignals } from "@/lib/daily-briefing/detect-signals";
import type { DailyBriefingMessage } from "@/lib/daily-briefing/types";
import { isEmailNewSinceVisit, type InboxVisitSnapshot } from "@/lib/daily-briefing/visit-snapshot";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { hasWaitingResponse, waitingOnLabel } from "@/lib/waiting-on/helpers";

const TAX = /\b(tax|irs|hmrc|1040|w-?2|1099|deduction|refund|tasse|fisco)\b/i;

export type ImportantChange = {
  id: string;
  emailId: string;
  label: string;
};

function messageMs(m: DailyBriefingMessage): number {
  if (typeof m.internalDateMs === "number" && m.internalDateMs > 0) return m.internalDateMs;
  if (m.date) {
    const t = new Date(m.date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function isNewMessage(m: DailyBriefingMessage, snapshot: InboxVisitSnapshot | null): boolean {
  return isEmailNewSinceVisit(m.id, messageMs(m), snapshot);
}

export function detectImportantChanges(
  messages: DailyBriefingMessage[],
  snapshot: InboxVisitSnapshot | null,
  waitingRecords: EmailCompletionRecord[],
  locale: "en" | "it",
): ImportantChange[] {
  if (!snapshot) return [];

  const out: ImportantChange[] = [];
  const seen = new Set<string>();

  for (const m of messages) {
    if (!isNewMessage(m, snapshot)) continue;
    const hay = `${m.sender} ${m.subject} ${m.snippet}`;
    const signals = detectMessageBriefingSignals(m);

    if (TAX.test(hay) && !seen.has("tax")) {
      seen.add("tax");
      out.push({
        id: `tax-${m.id}`,
        emailId: m.id,
        label:
          locale === "it" ? "✓ Nuova email fiscale" : "✓ New tax-related email",
      });
    }

    if (signals.schoolFamily && !seen.has("school")) {
      seen.add("school");
      out.push({
        id: `school-${m.id}`,
        emailId: m.id,
        label: locale === "it" ? "✓ Nuova email scuola" : "✓ New school email",
      });
    }

    if (signals.travel && !seen.has("travel")) {
      seen.add("travel");
      out.push({
        id: `travel-${m.id}`,
        emailId: m.id,
        label:
          locale === "it"
            ? "✓ Nuova conferma di viaggio"
            : "✓ New travel confirmation",
      });
    }
  }

  for (const record of waitingRecords) {
    if (!hasWaitingResponse(record) || !record.waitingResponseEmailId) continue;
    const who = waitingOnLabel(record, locale);
    const response = messages.find(
      (m) => m.id === record.waitingResponseEmailId && isNewMessage(m, snapshot),
    );
    if (response && !seen.has(`waiting-${record.emailId}`)) {
      seen.add(`waiting-${record.emailId}`);
      out.push({
        id: `waiting-response-${response.id}`,
        emailId: response.id,
        label: locale === "it" ? `✓ ${who} ha risposto` : `✓ ${who} replied`,
      });
    }
  }

  return out.slice(0, 5);
}
