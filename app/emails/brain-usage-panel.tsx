"use client";

import { useState } from "react";
import type { BrainUsageDto } from "@/lib/knowledge/types";
import { BRAIN_CATEGORY_LABELS } from "@/lib/handled-brain/types";
import type { BrainEntryCategory } from "@/lib/handled-brain/types";

const REASON_LABELS: Record<string, string> = {
  title_match: "Title match",
  keyword_overlap: "Keywords",
  category_intent: "Intent",
  semantic_topic: "Topic",
};

type BrainUsagePanelProps = {
  usage: BrainUsageDto | null;
  className?: string;
};

export function BrainUsagePanel({ usage, className = "" }: BrainUsagePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!usage?.active) {
    return null;
  }

  const entryCount = usage.entries.length;

  return (
    <div className={`rounded-xl border border-violet-200 bg-violet-50/80 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/60 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-800">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 text-violet-600"
              fill="none"
            >
              <path
                d="M8 2.5a4 4 0 0 1 3.9 3.2M8 2.5v4M5.5 11h5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <circle cx="8" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Using Handled Brain
          </span>
          {usage.writingStyleUsed && entryCount === 0 ? (
            <span className="text-xs text-violet-700">Writing style applied</span>
          ) : null}
          {entryCount > 0 ? (
            <span className="text-xs text-violet-700">
              {entryCount} {entryCount === 1 ? "entry" : "entries"} matched
            </span>
          ) : null}
        </div>
        {(entryCount > 0 || usage.writingStyleUsed) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-violet-700 underline-offset-2 hover:underline"
          >
            {expanded ? "Hide context" : "Show context used"}
          </button>
        )}
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-violet-200/80 px-4 py-3">
          {usage.writingStyleUsed ? (
            <p className="text-xs text-violet-800">
              <span className="font-medium">Writing style</span> from your Brain settings is
              included in the prompt.
            </p>
          ) : null}
          {usage.entries.map((entry) => {
            const catLabel =
              entry.category in BRAIN_CATEGORY_LABELS
                ? BRAIN_CATEGORY_LABELS[entry.category as BrainEntryCategory]
                : entry.category;
            return (
              <div
                key={entry.id}
                className="rounded-lg border border-violet-100 bg-white/90 p-3 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[#0F172A]">{entry.title}</p>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
                    {catLabel}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
                  {entry.contentPreview}
                  {entry.contentPreview.length >= 280 ? "…" : ""}
                </p>
                {entry.matchReasons.length > 0 ? (
                  <p className="mt-2 text-[10px] text-gray-400">
                    Matched:{" "}
                    {entry.matchReasons.map((r) => REASON_LABELS[r] ?? r).join(" · ")}
                  </p>
                ) : null}
              </div>
            );
          })}
          <p className="text-[10px] leading-relaxed text-violet-700/90">
            Replies use only facts from these entries. Handled will not send without your approval.
          </p>
        </div>
      ) : null}
    </div>
  );
}
