"use client";

import type { CategoryResolutionAudit } from "@/lib/final-category-resolution";
import type { AutopilotSummary } from "@/lib/autopilot/types";
import { isHandledDebug } from "@/lib/handled-debug";

type HandledDebugBadgeProps = {
  categoryResolution?: CategoryResolutionAudit;
  autopilot?: AutopilotSummary;
  categorySource?: string;
};

export function HandledDebugBadge({
  categoryResolution,
  autopilot,
  categorySource,
}: HandledDebugBadgeProps) {
  if (!isHandledDebug()) return null;
  if (!categoryResolution && !autopilot) return null;

  return (
    <details className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
      <summary className="cursor-pointer font-medium">Debug: category decision</summary>
      <dl className="mt-2 space-y-1 font-mono">
        {categoryResolution ? (
          <>
            <div>
              <dt className="inline text-amber-700">winning_rule: </dt>
              <dd className="inline">{categoryResolution.winningRule}</dd>
            </div>
            <div>
              <dt className="inline text-amber-700">final: </dt>
              <dd className="inline">
                {categoryResolution.finalCategory} ({categoryResolution.finalSource})
              </dd>
            </div>
            {categoryResolution.manualOverride ? (
              <div>
                <dt className="inline text-amber-700">manual_override: </dt>
                <dd className="inline">{categoryResolution.manualOverride}</dd>
              </div>
            ) : null}
            {categoryResolution.memoryLearned ? (
              <div>
                <dt className="inline text-amber-700">memory_rule: </dt>
                <dd className="inline">{categoryResolution.memoryLearned}</dd>
              </div>
            ) : null}
            {categoryResolution.correctionHistory ? (
              <div>
                <dt className="inline text-amber-700">correction_history: </dt>
                <dd className="inline">{categoryResolution.correctionHistory}</dd>
              </div>
            ) : null}
            {categoryResolution.senderLearned ? (
              <div>
                <dt className="inline text-amber-700">sender_rule: </dt>
                <dd className="inline">
                  {categoryResolution.senderLearned}
                  {categoryResolution.senderRuleLabel
                    ? ` (${categoryResolution.senderRuleLabel})`
                    : ""}
                </dd>
              </div>
            ) : null}
            {categoryResolution.overrideReason ? (
              <div>
                <dt className="inline text-amber-700">override_reason: </dt>
                <dd className="inline">{categoryResolution.overrideReason}</dd>
              </div>
            ) : null}
            {categoryResolution.aiCategory ? (
              <div>
                <dt className="inline text-amber-700">ai_guess: </dt>
                <dd className="inline">{categoryResolution.aiCategory}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {autopilot ? (
          <div>
            <dt className="inline text-amber-700">autopilot: </dt>
            <dd className="inline">
              {autopilot.state} — {autopilot.ruleTriggered}
            </dd>
          </div>
        ) : null}
        {categorySource ? (
          <div>
            <dt className="inline text-amber-700">source: </dt>
            <dd className="inline">{categorySource}</dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}
