import type {
  DailyBriefingGroup,
  DailyBriefingGroupId,
  DailyBriefingInsightTone,
} from "@/lib/daily-briefing/types";
import type { MessageBriefingSignals } from "@/lib/daily-briefing/detect-signals";

const GROUP_ORDER: DailyBriefingGroupId[] = [
  "needs_your_reply",
  "follow_ups",
  "deadlines",
  "meetings",
  "payments",
  "school_family",
  "waiting_on_others",
  "opportunities",
  "promotions_unsubscribe",
];

function groupTitle(id: DailyBriefingGroupId, locale: "en" | "it"): string {
  const en: Record<DailyBriefingGroupId, string> = {
    needs_your_reply: "Needs your reply",
    waiting_on_others: "Waiting on others",
    meetings: "Meetings & scheduling",
    payments: "Payments",
    school_family: "School & family",
    opportunities: "Opportunities",
    promotions_unsubscribe: "Promotions worth unsubscribing",
    follow_ups: "Follow-ups",
    deadlines: "Deadlines approaching",
  };
  const it: Record<DailyBriefingGroupId, string> = {
    needs_your_reply: "Richiedono risposta",
    waiting_on_others: "In attesa di altri",
    meetings: "Meeting e calendario",
    payments: "Pagamenti",
    school_family: "Scuola e famiglia",
    opportunities: "Opportunita",
    promotions_unsubscribe: "Promozioni da disiscrivere",
    follow_ups: "Follow-up",
    deadlines: "Scadenze in avvicinamento",
  };
  return locale === "it" ? it[id] : en[id];
}

function groupCalmNote(id: DailyBriefingGroupId, locale: "en" | "it"): string | undefined {
  if (id === "promotions_unsubscribe") {
    return locale === "it"
      ? "Solo se vuoi alleggerire la inbox — nessuna azione automatica."
      : "Only if you want a lighter inbox — nothing happens automatically.";
  }
  if (id === "payments") {
    return locale === "it"
      ? "Handled non paga o invia nulla per te."
      : "Handled never pays or sends on your behalf.";
  }
  return undefined;
}

export function assignPrimaryBriefingGroup(
  s: MessageBriefingSignals,
): DailyBriefingGroupId | null {
  if (s.needsReply) return "needs_your_reply";
  if (s.followUpRecommended) return "follow_ups";
  if (s.deadline) return "deadlines";
  if (s.meeting) return "meetings";
  if (s.payment) return "payments";
  if (s.schoolFamily) return "school_family";
  if (s.waitingOnOthers) return "waiting_on_others";
  if (s.opportunity) return "opportunities";
  if (s.promotionUnsubscribe) return "promotions_unsubscribe";
  return null;
}

export function buildBriefingGroups(
  signals: MessageBriefingSignals[],
  locale: "en" | "it",
): DailyBriefingGroup[] {
  const buckets = new Map<DailyBriefingGroupId, string[]>();

  for (const s of signals) {
    const id = assignPrimaryBriefingGroup(s);
    if (!id) continue;
    const list = buckets.get(id) ?? [];
    if (!list.includes(s.emailId)) list.push(s.emailId);
    buckets.set(id, list);
  }

  return GROUP_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map(
    (id) => ({
      id,
      title: groupTitle(id, locale),
      count: buckets.get(id)!.length,
      emailIds: buckets.get(id)!,
      calmNote: groupCalmNote(id, locale),
    }),
  );
}

export function insightToneForCount(count: number): DailyBriefingInsightTone {
  if (count === 0) return "quiet";
  if (count >= 4) return "gentle_attention";
  return "neutral";
}
