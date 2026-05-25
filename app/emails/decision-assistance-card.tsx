"use client";

import type { DecisionAssistanceResult } from "@/lib/decision-assistance";

type DecisionAssistanceCardProps = {
  analysis: DecisionAssistanceResult;
  locale: "en" | "it";
};

export function DecisionAssistanceCard({
  analysis,
  locale,
}: DecisionAssistanceCardProps) {
  if (!analysis?.active) return null;

  const insights = analysis.insights ?? [];
  const opportunities = analysis.opportunities ?? [];
  const risks = analysis.risks ?? [];

  const oppLabel = locale === "it" ? "Opportunita" : "Opportunity";
  const riskLabel = locale === "it" ? "Da considerare" : "Worth a second look";

  return (
    <div className="space-y-4 text-sm leading-relaxed text-gray-700">
      {insights.length > 0 ? (
        <ul className="space-y-3">
          {insights.map((insight) => (
            <li key={insight.id}>
              <p className="text-gray-800">{insight.whyItMatters}</p>
              {insight.calmDetail ? (
                <p className="mt-1 text-xs text-gray-500">{insight.calmDetail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {opportunities.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">{oppLabel}</p>
          {opportunities.map((o) => (
            <p key={o.id} className="text-gray-700">
              {o.message}
            </p>
          ))}
        </div>
      ) : null}

      {risks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">{riskLabel}</p>
          <ul className="space-y-2">
            {risks.map((r) => (
              <li key={r.id} className="text-gray-700">
                {r.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
