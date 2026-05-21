import type {
  DailyBriefingHighlight,
  DailyBriefingStats,
} from "@/lib/daily-briefing/types";

export function buildBriefingHighlights(
  stats: DailyBriefingStats,
  locale: "en" | "it",
): DailyBriefingHighlight[] {
  const out: DailyBriefingHighlight[] = [];

  if (stats.needsReply > 0) {
    out.push({
      id: "needs_reply",
      count: stats.needsReply,
      label:
        locale === "it"
          ? `${stats.needsReply} email ${stats.needsReply === 1 ? "richiede" : "richiedono"} risposta`
          : stats.needsReply === 1
            ? "1 email needs a reply"
            : `${stats.needsReply} emails need replies`,
    });
  }

  if (stats.followUpsRecommended > 0) {
    out.push({
      id: "follow_ups",
      count: stats.followUpsRecommended,
      label:
        locale === "it"
          ? `${stats.followUpsRecommended} follow-up consigliat${stats.followUpsRecommended === 1 ? "o" : "i"}`
          : stats.followUpsRecommended === 1
            ? "1 follow-up recommended"
            : `${stats.followUpsRecommended} follow-ups recommended`,
    });
  }

  if (stats.schoolFamily > 0) {
    out.push({
      id: "school_family",
      count: stats.schoolFamily,
      label:
        locale === "it"
          ? `${stats.schoolFamily} email scuola/famiglia`
          : stats.schoolFamily === 1
            ? "1 school-related email"
            : `${stats.schoolFamily} school-related emails`,
    });
  }

  if (stats.deadlinesApproaching > 0) {
    out.push({
      id: "deadlines",
      count: stats.deadlinesApproaching,
      label:
        locale === "it"
          ? stats.deadlinesApproaching === 1
            ? "1 scadenza in avvicinamento"
            : `${stats.deadlinesApproaching} scadenze in avvicinamento`
          : stats.deadlinesApproaching === 1
            ? "1 deadline approaching"
            : `${stats.deadlinesApproaching} deadlines approaching`,
    });
  }

  if (stats.travelRelated > 0) {
    out.push({
      id: "travel",
      count: stats.travelRelated,
      label:
        locale === "it"
          ? "Email di viaggio rilevate"
          : "Travel-related emails detected",
    });
  }

  if (stats.meetings > 0 && !out.some((h) => h.id === "deadlines")) {
    out.push({
      id: "meetings",
      count: stats.meetings,
      label:
        locale === "it"
          ? `${stats.meetings} meeting o appuntament${stats.meetings === 1 ? "o" : "i"}`
          : stats.meetings === 1
            ? "1 meeting to review"
            : `${stats.meetings} meetings to review`,
    });
  }

  if (stats.payments > 0) {
    out.push({
      id: "payments",
      count: stats.payments,
      label:
        locale === "it"
          ? `${stats.payments} pagamento in sospeso`
          : stats.payments === 1
            ? "1 payment to review"
            : `${stats.payments} payments to review`,
    });
  }

  return out.slice(0, 6);
}
