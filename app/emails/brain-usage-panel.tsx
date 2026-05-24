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
    <div className={`rounded-lg border border-accent/15 bg-white ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip-ai">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
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
            Handled Brain
          </span>
          {usage.writingStyleUsed && entryCount === 0 ? (
            <span className="text-xs text-secondary">Writing style applied</span>
          ) : null}
          {entryCount > 0 ? (
            <span className="text-xs text-secondary">
              {entryCount} {entryCount === 1 ? "entry" : "entries"} matched
            </span>
          ) : null}
        </div>
        {(entryCount > 0 || usage.writingStyleUsed) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-accent underline-offset-2 hover:text-accent-hover hover:underline"
          >
            {expanded ? "Hide context" : "Show context used"}
          </button>
        )}
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {usage.writingStyleUsed ? (
            <p className="text-xs text-secondary">
              <span className="font-medium text-foreground">Writing style</span> from your Brain
              settings is included in the prompt.
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
                className="rounded-lg border border-border bg-background p-3 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{entry.title}</p>
                  <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent">
                    {catLabel}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-secondary">
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
          <p className="trust-line">
            <strong>Your approval required.</strong> Replies use only facts from these entries.
          </p>
        </div>
      ) : null}
    </div>
  );
}
