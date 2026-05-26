import { senderFirstNameFromRow } from "@/lib/follow-up/format";
import type {
  DecisionAwarenessKind,
  DecisionConfidenceLevel,
  DecisionInsight,
  DecisionOpportunity,
  DecisionRisk,
} from "@/lib/decision-assistance/types";
import type { DetectedDecisionSignal } from "@/lib/decision-assistance/detect-signals";

function confidenceFromStrength(strength: number): DecisionConfidenceLevel {
  if (strength >= 75) return "high_confidence";
  if (strength >= 52) return "possible_concern";
  return "low_suggestion";
}

function insightId(kind: string, suffix: string): string {
  return `${kind}:${suffix}`;
}

export function buildDecisionInsights(
  signals: DetectedDecisionSignal[],
  input: { sender: string; locale: "en" | "it" },
): DecisionInsight[] {
  const locale = input.locale;
  const name = senderFirstNameFromRow(input.sender);
  const insights: DecisionInsight[] = [];
  const seen = new Set<string>();

  for (const s of signals.sort((a, b) => b.strength - a.strength)) {
    if (seen.has(s.kind)) continue;
    seen.add(s.kind);
    const confidence = confidenceFromStrength(s.strength);

    const copy = insightCopy(s.kind, name, locale, confidence);
    if (!copy) continue;

    insights.push({
      id: insightId(s.kind, s.reason),
      kind: s.kind,
      whyItMatters: copy.why,
      confidence,
      calmDetail: copy.detail,
    });
  }

  return insights.slice(0, 5);
}

function insightCopy(
  kind: DetectedDecisionSignal["kind"],
  name: string,
  locale: "en" | "it",
  confidence: DecisionConfidenceLevel,
): { why: string; detail?: string } | null {
  const lowNote =
    locale === "it"
      ? "Segnale leggero — verifica se ti serve."
      : "A light signal — check if it matters to you.";

  const detail =
    confidence === "low_suggestion"
      ? lowNote
      : locale === "it"
        ? "Tu decidi sempre."
        : "You always decide.";

  const en: Record<typeof kind, string> = {
    financial_request: "This thread may affect payment timing or billing.",
    scheduling_conflict: "Scheduling may need your review — nothing is booked automatically.",
    unresolved_approval: "An approval or decision may still be open.",
    escalating_conversation: "This thread may need a calm reply soon.",
    business_opportunity: "This may be a valuable business opportunity.",
    potential_risk: `Important thread with ${name} — worth checking when you can.`,
    deadline_approaching: "A mentioned deadline may be approaching.",
  };

  const it: Record<typeof kind, string> = {
    financial_request: "Questo thread può influire su pagamenti o fatturazione.",
    scheduling_conflict: "La programmazione richiede revisione — nulla viene prenotato da solo.",
    unresolved_approval: "Un'approvazione o decisione potrebbe essere ancora aperta.",
    escalating_conversation: "Questo thread potrebbe meritare una risposta calma presto.",
    business_opportunity: "Potrebbe essere un'opportunita di valore.",
    potential_risk: `Thread importante con ${name} — da vedere quando puoi.`,
    deadline_approaching: "Una scadenza citata potrebbe avvicinarsi.",
  };

  if (kind === "potential_risk" && confidence === "high_confidence") {
    return {
      why:
        locale === "it"
          ? `Cliente VIP in attesa di risposta.`
          : `VIP client awaiting response.`,
      detail,
    };
  }

  return {
    why: locale === "it" ? it[kind] : en[kind],
    detail,
  };
}

export function buildOpportunities(
  signals: DetectedDecisionSignal[],
  locale: "en" | "it",
): DecisionOpportunity[] {
  const opp = signals.filter((s) => s.kind === "business_opportunity");
  if (!opp.length) return [];

  const strength = Math.max(...opp.map((s) => s.strength));
  const confidence = confidenceFromStrength(strength);
  const reason = opp[0]?.reason ?? "business";

  const labels: Record<string, { en: string; it: string }> = {
    pricing_inquiry: { en: "Enterprise pricing", it: "Pricing enterprise" },
    sales_lead: { en: "Inbound sales", it: "Vendita inbound" },
    partnership: { en: "Partnership", it: "Partnership" },
    interview_opportunity: { en: "Interview opportunity", it: "Opportunita colloquio" },
    meeting_invitation: { en: "Meeting invitation", it: "Invito meeting" },
  };

  const label = labels[reason] ?? { en: "Business opportunity", it: "Opportunita" };

  return [
    {
      id: `opp:${reason}`,
      label: locale === "it" ? label.it : label.en,
      message:
        locale === "it"
          ? "Potrebbe essere un'opportunita utile — valuta con calma."
          : "This may be a valuable opportunity — worth a calm review.",
      confidence,
    },
  ];
}

export function buildRisks(
  signals: DetectedDecisionSignal[],
  locale: "en" | "it",
): DecisionRisk[] {
  const risks = signals.filter((s) => s.kind === "potential_risk");
  const out: DecisionRisk[] = [];

  for (const s of risks.slice(0, 3)) {
    const confidence = confidenceFromStrength(s.strength);
    const msg = riskMessage(s.reason, locale);
    if (!msg) continue;
    out.push({
      id: `risk:${s.reason}`,
      label: locale === "it" ? "Possibile rischio" : "Possible risk",
      message: msg,
      confidence,
    });
  }

  return out.slice(0, 3);
}

function riskMessage(reason: string, locale: "en" | "it"): string | null {
  const en: Record<string, string> = {
    vip_thread_open: "VIP thread is still open — no pressure to reply instantly.",
    at_risk_forgotten: "Easy to forget — kept gently visible here.",
    repeated_follow_ups: "A few follow-ups in this thread — a calm reply may help.",
    unanswered_important: "Important thread unanswered for several days.",
    missed_confirmation: "Confirmation may still be outstanding.",
  };
  const it: Record<string, string> = {
    vip_thread_open: "Thread VIP ancora aperto — nessuna pressione immediata.",
    at_risk_forgotten: "Facile da dimenticare — tenuto visibile con calma.",
    repeated_follow_ups: "Qualche follow-up in questo thread — una risposta calma può aiutare.",
    unanswered_important: "Thread importante senza risposta da giorni.",
    missed_confirmation: "Conferma forse ancora in sospeso.",
  };
  return locale === "it" ? it[reason] ?? null : en[reason] ?? null;
}
