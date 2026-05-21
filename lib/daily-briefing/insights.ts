import type {
  DailyBriefingInsight,
  DailyBriefingStats,
} from "@/lib/daily-briefing/types";
import type { MessageBriefingSignals } from "@/lib/daily-briefing/detect-signals";

export function buildBriefingInsights(
  stats: DailyBriefingStats,
  signals: MessageBriefingSignals[],
  locale: "en" | "it",
): DailyBriefingInsight[] {
  const out: DailyBriefingInsight[] = [];
  const handledYesterday = signals.filter((s) => s.handledYesterday).length;
  const vipInactive = signals.find((s) => (s.vipInactiveDays ?? 0) >= 5);

  const quiet =
    stats.needsReply === 0 &&
    stats.followUpsRecommended <= 1 &&
    stats.deadlinesApproaching === 0;

  if (quiet) {
    out.push({
      id: "quiet_day",
      tone: "quiet",
      message:
        locale === "it"
          ? "Giornata tranquilla in inbox — niente di urgente."
          : "Quiet inbox day — nothing urgent on your plate.",
    });
  }

  if (handledYesterday >= 3) {
    out.push({
      id: "handled_yesterday",
      tone: "positive",
      message:
        locale === "it"
          ? "Ieri hai gestito la maggior parte delle risposte — buon ritmo."
          : "You handled most replies yesterday — steady progress.",
    });
  }

  if (stats.followUpsRecommended >= 3) {
    out.push({
      id: "several_follow_ups",
      tone: "gentle_attention",
      message:
        locale === "it"
          ? "Alcuni follow-up potrebbero meritare attenzione — solo quando vuoi."
          : "Several follow-ups may need attention — only when you are ready.",
    });
  }

  if (vipInactive?.vipInactiveDays) {
    const days = vipInactive.vipInactiveDays;
    out.push({
      id: "vip_inactive",
      tone: "neutral",
      message:
        locale === "it"
          ? `Thread VIP inattivo da ${days} giorni — nessuna pressione.`
          : `VIP thread inactive for ${days} days — no pressure.`,
    });
  }

  if (stats.travelRelated > 0 && !out.some((i) => i.id === "quiet_day")) {
    out.push({
      id: "travel_context",
      tone: "neutral",
      message:
        locale === "it"
          ? "Email di viaggio in vista — utile per pianificare con calma."
          : "Travel-related mail in view — helpful for calm planning.",
    });
  }

  if (
    stats.needsReply > 0 &&
    stats.needsReply <= 2 &&
    stats.followUpsRecommended === 0 &&
    !out.some((i) => i.id === "quiet_day")
  ) {
    out.push({
      id: "light_load",
      tone: "neutral",
      message:
        locale === "it"
          ? "Carico leggero oggi — pochi thread richiedono risposta."
          : "Light load today — only a few threads need a reply.",
    });
  }

  return out.slice(0, 4);
}
