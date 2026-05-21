"use client";

import type {
  DecisionAssistanceResult,
  DecisionConfidenceLevel,
} from "@/lib/decision-assistance";

type DecisionAssistanceCardProps = {
  analysis: DecisionAssistanceResult;
  locale: "en" | "it";
};

const CONFIDENCE_STYLES: Record<DecisionConfidenceLevel, string> = {
  high_confidence: "bg-slate-100 text-slate-700 border-slate-200",
  possible_concern: "bg-amber-50/80 text-amber-900 border-amber-100",
  low_suggestion: "bg-slate-50 text-slate-500 border-slate-100",
};

function confidenceLabel(level: DecisionConfidenceLevel, locale: "en" | "it"): string {
  const en: Record<DecisionConfidenceLevel, string> = {
    high_confidence: "High confidence",
    possible_concern: "Possible concern",
    low_suggestion: "Light suggestion",
  };
  const it: Record<DecisionConfidenceLevel, string> = {
    high_confidence: "Alta attendibilita",
    possible_concern: "Possibile attenzione",
    low_suggestion: "Suggerimento leggero",
  };
  return locale === "it" ? it[level] : en[level];
}

export function DecisionAssistanceCard({
  analysis,
  locale,
}: DecisionAssistanceCardProps) {
  if (!analysis.active) return null;

  const title =
    locale === "it" ? "Guida alle decisioni" : "Decision guidance";
  const subtitle =
    locale === "it"
      ? "Handled nota cosa puo contare — tu decidi sempre."
      : "Handled notices what may matter — you always decide.";
  const whyLabel = locale === "it" ? "Perche conta" : "Why this matters";
  const oppLabel = locale === "it" ? "Opportunita" : "Opportunity";
  const riskLabel = locale === "it" ? "Rischi da considerare" : "Risks to consider";

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/90 to-white p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
        <span
          className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CONFIDENCE_STYLES[analysis.primaryConfidence]}`}
        >
          {confidenceLabel(analysis.primaryConfidence, locale)}
        </span>
      </div>

      {analysis.insights.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">{whyLabel}</p>
          <ul className="space-y-2">
            {analysis.insights.map((insight) => (
              <li
                key={insight.id}
                className="rounded-lg border border-slate-100 bg-white/80 px-3 py-2.5"
              >
                <p className="text-sm leading-relaxed text-slate-800">
                  {insight.whyItMatters}
                </p>
                {insight.calmDetail ? (
                  <p className="mt-1 text-xs text-slate-500">{insight.calmDetail}</p>
                ) : null}
                <span
                  className={`mt-2 inline-block rounded-md border px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLES[insight.confidence]}`}
                >
                  {confidenceLabel(insight.confidence, locale)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {analysis.opportunities.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-emerald-800/90">{oppLabel}</p>
          {analysis.opportunities.map((o) => (
            <p
              key={o.id}
              className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm text-emerald-900"
            >
              {o.message}
            </p>
          ))}
        </div>
      ) : null}

      {analysis.risks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">{riskLabel}</p>
          <ul className="space-y-2">
            {analysis.risks.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-slate-100 bg-white/60 px-3 py-2 text-sm text-slate-700"
              >
                {r.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
