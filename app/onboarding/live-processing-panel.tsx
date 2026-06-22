"use client";

import {
  LIVE_PROCESSING_LINES,
  type LiveProcessingLineId,
} from "@/lib/onboarding/live-processing-copy";

type LiveProcessingPanelProps = {
  locale: "en" | "it";
  activeLineId: LiveProcessingLineId | null;
  activeLineIndex: number;
  totalLines: number;
  showResultBanner: boolean;
  compact?: boolean;
};

export function LiveProcessingPanel({
  locale,
  activeLineId,
  activeLineIndex,
  totalLines,
  showResultBanner,
  compact,
}: LiveProcessingPanelProps) {
  const lines = LIVE_PROCESSING_LINES[locale];
  const label = activeLineId ? lines[activeLineId] : lines.scanning;
  const progress = totalLines > 0 ? ((activeLineIndex + 1) / totalLines) * 100 : 0;

  return (
    <div
      className={`rounded-2xl border border-accent/15 bg-gradient-to-br from-accent-muted/25 via-white to-white shadow-sm ${
        compact ? "px-4 py-4" : "px-6 py-5"
      }`}
      aria-live="polite"
      aria-busy={!showResultBanner}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-accent/10 ${
            showResultBanner ? "h-8 w-8" : "h-8 w-8"
          }`}
          aria-hidden
        >
          {showResultBanner ? (
            <span className="text-sm text-accent">✓</span>
          ) : (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            key={activeLineId ?? "idle"}
            className={`text-sm font-medium text-gray-800 calm-fade-in ${
              showResultBanner ? "text-accent" : ""
            }`}
          >
            {showResultBanner ? lines.resultReady : label}
          </p>
          {!showResultBanner ? (
            <p className="mt-1 text-xs text-gray-400">
              {locale === "it" ? "Dammi un momento…" : "Give me a moment…"}
            </p>
          ) : null}
          {!showResultBanner ? (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
