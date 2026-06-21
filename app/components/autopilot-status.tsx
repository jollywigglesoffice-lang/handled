import { autopilotStateLabel } from "@/lib/autopilot/copy";
import type { AutopilotSummary } from "@/lib/autopilot/types";

/** Pre-computed suggestion — assisted state only. */
export function AutopilotSuggestionLine({
  autopilot,
  locale,
}: {
  autopilot: AutopilotSummary;
  locale: "en" | "it";
}) {
  if (autopilot.state !== "assisted") return null;

  return (
    <p className="text-xs text-violet-600/80 calm-fade-in">
      {autopilotStateLabel("assisted", locale)}:{" "}
      <span className="font-medium">{autopilot.suggestedActionLabel}</span>
    </p>
  );
}

/** Uncertain email — needs attention state. */
export function AutopilotAttentionBadge({
  autopilot,
  locale,
}: {
  autopilot: AutopilotSummary;
  locale: "en" | "it";
}) {
  if (autopilot.state !== "worth_your_attention") return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-rose-600/80">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden />
      {autopilotStateLabel("worth_your_attention", locale)}
    </span>
  );
}
