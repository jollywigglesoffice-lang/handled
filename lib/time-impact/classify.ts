import { detectSchedulingIntent } from "@/lib/calendar-awareness/detect-scheduling-intent";
import { hasExplicitDeadline } from "@/lib/explicit-email-signals";
import type { ActionIntelligenceSummary } from "@/lib/action-intelligence";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { resolveInboxEmotionalState } from "@/lib/inbox-emotional-state";
import type {
  InboxFlowBand,
  TimeImpactKind,
  TimeImpactResult,
  TimeStripBand,
} from "@/lib/time-impact/types";

const DEADLINE_HAY =
  /\b(by (?:eod|cob|end of day|tomorrow|today|friday|monday|tuesday|wednesday|thursday|saturday|sunday)|due (?:on|by)|deadline|entro (?:domani|venerdì|lunedì)|scadenza|time.?sensitive|asap|urgent)\b/i;

const TODAY_HAY = /\b(today|oggi|this afternoon|this morning|by eod|cob|end of day)\b/i;
const TOMORROW_HAY = /\b(tomorrow|domani)\b/i;
const THIS_WEEK_HAY =
  /\b(this week|friday|monday|tuesday|wednesday|thursday|saturday|sunday|venerdì|lunedì|martedì|mercoledì|giovedì)\b/i;

export type ClassifyTimeImpactInput = {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  category?: InboxAiCategory;
  needsCalendarContext?: boolean;
  actionIntelligence?: ActionIntelligenceSummary;
  extraBody?: string;
};

function haystack(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): string {
  const base = `${row.sender} ${row.subject} ${row.snippet ?? ""}`;
  return extraBody ? `${base} ${extraBody}`.toLowerCase() : base.toLowerCase();
}

function inferTimeBand(hay: string, kind: TimeImpactKind): TimeStripBand | null {
  if (kind === "time_free") return null;
  if (TODAY_HAY.test(hay)) return "today";
  if (TOMORROW_HAY.test(hay)) return "tomorrow";
  if (THIS_WEEK_HAY.test(hay)) return "this_week";
  if (kind === "time_blocker") return "this_week";
  if (kind === "time_sensitive") return "this_week";
  return "later";
}

function deadlineHintFromHay(hay: string): string | undefined {
  const m = hay.match(
    /\b(by (?:eod|cob|end of day|tomorrow|today|friday|monday|tuesday|wednesday|thursday|saturday|sunday)|due (?:on|by) [^\n,.]{0,24}|entro (?:domani|venerdì|lunedì)|deadline[^\n,.]{0,24})\b/i,
  );
  return m?.[1]?.trim().slice(0, 48);
}

function resolveFlowBand(
  kind: TimeImpactKind,
  input: ClassifyTimeImpactInput,
): InboxFlowBand {
  if (kind === "time_blocker" || kind === "time_sensitive") return "action_flow";
  const emotional = resolveInboxEmotionalState({
    category: input.category ?? "good_to_know",
    actionIntelligence: input.actionIntelligence,
  });
  return emotional === "calm" ? "awareness_flow" : "action_flow";
}

function priorityScore(
  kind: TimeImpactKind,
  flowBand: InboxFlowBand,
  timeBand: TimeStripBand | null,
): number {
  const kindBase =
    kind === "time_blocker" ? 3000 : kind === "time_sensitive" ? 2000 : 0;
  const bandBonus =
    timeBand === "today"
      ? 300
      : timeBand === "tomorrow"
        ? 200
        : timeBand === "this_week"
          ? 100
          : 0;
  const flowBonus = flowBand === "action_flow" ? 50 : 0;
  return kindBase + bandBonus + flowBonus;
}

export function classifyTimeImpact(input: ClassifyTimeImpactInput): TimeImpactResult {
  const hay = haystack(input.row, input.extraBody);
  const scheduling = detectSchedulingIntent(input.row, input.extraBody);
  const primaryLabel = input.actionIntelligence?.primaryLabel;
  const actionState = input.actionIntelligence?.actionState;

  let kind: TimeImpactKind = "time_free";

  const isBlocker =
    scheduling.needsCalendarContext &&
    scheduling.kinds.some((k) =>
      ["meeting_request", "appointment_request", "reschedule", "calendar_reference"].includes(k),
    );

  const isSensitive =
    !isBlocker &&
    (primaryLabel === "deadline" ||
      primaryLabel === "urgent" ||
      primaryLabel === "payment" ||
      hasExplicitDeadline(hay) ||
      DEADLINE_HAY.test(hay) ||
      (actionState === "actionable" && DEADLINE_HAY.test(hay)));

  if (isBlocker) {
    kind = "time_blocker";
  } else if (isSensitive) {
    kind = "time_sensitive";
  }

  const flowBand = resolveFlowBand(kind, input);
  const timeBand = inferTimeBand(hay, kind);
  const deadlineHint = kind !== "time_free" ? deadlineHintFromHay(hay) : undefined;

  return {
    kind,
    flowBand,
    timeBand,
    priorityScore: priorityScore(kind, flowBand, timeBand),
    deadlineHint,
  };
}
