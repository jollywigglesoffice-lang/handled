import { detectImpliedActions, isActionableEmail } from "@/lib/action-intelligence/detect-implied-actions";
import {
  actionLabelTitle,
  impliedActionsToLabels,
  pickPrimaryLabel,
} from "@/lib/action-intelligence/labels";
import { resolveEmailActionState } from "@/lib/action-intelligence/resolve-action-state";
import { buildSafeReminders } from "@/lib/action-intelligence/safe-reminders";
import { suggestNextAction } from "@/lib/action-intelligence/suggest-next-action";
import { extractTaskAwareness } from "@/lib/action-intelligence/task-awareness";
import type {
  ActionIntelligenceResult,
  ActionIntelligenceSummary,
  AnalyzeActionIntelligenceInput,
} from "@/lib/action-intelligence/types";

export function analyzeActionIntelligence(
  input: AnalyzeActionIntelligenceInput,
): ActionIntelligenceResult {
  const locale = input.locale ?? "en";
  const row = {
    sender: input.row.sender,
    subject: input.row.subject,
    snippet: input.row.snippet ?? "",
  };
  const implied = detectImpliedActions(row, input.extraBody);
  const heuristicActionable = isActionableEmail(implied, input.category, row, input.extraBody);
  const labels = impliedActionsToLabels(implied);
  const taskAwareness = extractTaskAwareness(row, input.extraBody);
  const haystack = `${row.sender} ${row.subject} ${row.snippet} ${input.extraBody ?? ""}`.toLowerCase();

  const confidence = Math.min(
    0.96,
    0.55 +
      implied.length * 0.06 +
      taskAwareness.length * 0.05 +
      (labels.length > 0 ? 0.1 : 0),
  );

  const actionState = resolveEmailActionState({
    row,
    extraBody: input.extraBody,
    category: input.category,
    implied,
    heuristicActionable,
    confidence,
  });

  const actionable = actionState === "actionable";
  const showActionHints = actionState === "actionable" || actionState === "waiting_response";
  const primaryLabel = showActionHints ? pickPrimaryLabel(labels) : null;
  const suggestedNextAction = showActionHints
    ? suggestNextAction({ primaryLabel, implied, taskAwareness, locale, haystack })
    : null;
  const safeReminders = showActionHints
    ? buildSafeReminders({ implied, taskAwareness, locale })
    : [];

  return {
    actionable,
    actionState,
    impliedActions: implied,
    labels,
    primaryLabel,
    suggestedNextAction,
    taskAwareness,
    safeReminders,
    confidence,
  };
}

export function summarizeActionIntelligence(
  result: ActionIntelligenceResult,
): ActionIntelligenceSummary {
  return {
    actionable: result.actionable,
    actionState: result.actionState,
    primaryLabel: result.primaryLabel,
    suggestedNextAction: result.suggestedNextAction,
  };
}

export function formatActionIntelligenceForPrompt(
  result: ActionIntelligenceResult,
  locale: "en" | "it" = "en",
): string {
  if (!result.actionable || !result.primaryLabel) return "";

  const lines = [
    `Implied action: ${actionLabelTitle(result.primaryLabel, locale)}`,
    result.suggestedNextAction ? `Suggested next step: ${result.suggestedNextAction}` : "",
    result.taskAwareness.length
      ? `Task cues: ${result.taskAwareness.map((t) => t.text).join("; ")}`
      : "",
    "Never auto-complete actions or send on the user's behalf.",
  ].filter(Boolean);

  return lines.join("\n");
}
