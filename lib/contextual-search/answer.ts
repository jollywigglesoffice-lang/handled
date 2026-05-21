import { senderFirstNameFromRow } from "@/lib/follow-up/format";
import type { ParsedSearchQuery } from "@/lib/contextual-search/parse-query";
import type {
  ContextualSearchAnswer,
  ContextualSearchHit,
} from "@/lib/contextual-search/types";

function daysAgo(ms?: number): number | null {
  if (!ms) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
}

function personFromSender(sender?: string): string {
  if (!sender) return "They";
  return senderFirstNameFromRow(sender);
}

export function buildSearchAnswer(
  parsed: ParsedSearchQuery,
  hits: ContextualSearchHit[],
  locale: "en" | "it",
): ContextualSearchAnswer | null {
  if (!hits.length) return null;

  const top = hits[0]!;
  const emailIds = [
    ...new Set(hits.map((h) => h.record.emailId).filter(Boolean) as string[]),
  ].slice(0, 3);

  if (parsed.intents.includes("reply_check")) {
    const waiting = hits.find(
      (h) => h.record.followUpState === "waiting_for_response",
    );
    const target = waiting ?? top;
    const name = parsed.personTokens[0]
      ? parsed.personTokens[0].charAt(0).toUpperCase() + parsed.personTokens[0].slice(1)
      : personFromSender(target.record.sender);
    const days = daysAgo(target.record.internalDateMs);

    if (waiting) {
      return {
        confidence: days !== null && days <= 7 ? "high" : "medium",
        basedOnEmailIds: emailIds,
        text:
          locale === "it"
            ? days !== null
              ? `${name} ha risposto ${days === 0 ? "oggi" : days === 1 ? "ieri" : `${days} giorni fa`} — thread ancora aperto.`
              : `${name} sembra aver risposto — thread ancora aperto.`
            : days !== null
              ? `${name} replied ${days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`} — thread still open.`
              : `${name} appears to have replied — thread still open.`,
      };
    }

    const awaitingYou = hits.find(
      (h) => h.record.followUpState === "awaiting_your_reply",
    );
    if (awaitingYou) {
      return {
        confidence: "medium",
        basedOnEmailIds: emailIds,
        text:
          locale === "it"
            ? `Nessuna risposta recente da ${name} — potrebbe attendere la tua.`
            : `No recent reply from ${name} — they may be waiting on you.`,
      };
    }
  }

  if (parsed.intents.includes("find_mention") || parsed.inferredFilter === "school") {
    const schoolHit =
      hits.find((h) => h.record.filters.includes("school")) ?? top;
    const subject = schoolHit.record.subject ?? schoolHit.record.title;
    const snippet = schoolHit.snippetHighlight ?? schoolHit.record.body.slice(0, 120);
    return {
      confidence: "medium",
      basedOnEmailIds: emailIds,
      text:
        locale === "it"
          ? `Scuola / famiglia: “${subject}” — ${snippet}`
          : `School / family: “${subject}” — ${snippet}`,
    };
  }

  if (parsed.inferredFilter === "invoices") {
    const inv = hits.find((h) => h.record.filters.includes("invoices")) ?? top;
    return {
      confidence: "medium",
      basedOnEmailIds: emailIds,
      text:
        locale === "it"
          ? `Fatture / pagamenti: ${inv.record.subject ?? inv.record.title}`
          : `Invoices / billing: ${inv.record.subject ?? inv.record.title}`,
    };
  }

  if (parsed.intents.includes("list_follow_ups")) {
    const count = hits.filter((h) => h.record.source === "follow_up").length;
    return {
      confidence: count > 0 ? "high" : "low",
      basedOnEmailIds: emailIds,
      text:
        locale === "it"
          ? count
            ? `${count} follow-up trovati — nessuna azione automatica.`
            : "Nessun follow-up corrispondente al momento."
          : count
            ? `${count} matching follow-ups — nothing happens automatically.`
            : "No matching follow-ups right now.",
    };
  }

  const best = top.record;
  const days = daysAgo(best.internalDateMs);
  const timePhrase =
    locale === "it"
      ? days === null
        ? ""
        : days === 0
          ? " (oggi)"
          : days === 1
            ? " (ieri)"
            : ` (${days} giorni fa)`
      : days === null
        ? ""
        : days === 0
          ? " (today)"
          : days === 1
            ? " (yesterday)"
            : ` (${days} days ago)`;

  return {
    confidence: top.score >= 12 ? "high" : "medium",
    basedOnEmailIds: emailIds,
    text:
      locale === "it"
        ? `Trovato: “${best.subject ?? best.title}”${timePhrase}. ${top.snippetHighlight ?? ""}`.trim()
        : `Found: “${best.subject ?? best.title}”${timePhrase}. ${top.snippetHighlight ?? ""}`.trim(),
  };
}
