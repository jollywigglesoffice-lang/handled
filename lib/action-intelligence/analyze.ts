import { detectImpliedActions, isActionableEmail } from "@/lib/action-intelligence/detect-implied-actions";
import {
  actionLabelTitle,
  impliedActionsToLabels,
  pickPrimaryLabel,
} from "@/lib/action-intelligence/labels";
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
  const actionable = isActionableEmail(implied, input.category);
  const labels = impliedActionsToLabels(implied);
  const primaryLabel = actionable ? pickPrimaryLabel(labels) : null;
  const taskAwareness = extractTaskAwareness(row, input.extraBody);
  const suggestedNextAction = actionable
    ? suggestNextAction({ primaryLabel, implied, taskAwareness, locale })
    : null;
  const safeReminders = actionable
    ? buildSafeReminders({ implied, taskAwareness, locale })
    : [];

  const confidence = Math.min(
    0.96,
    0.55 +
      implied.length * 0.06 +
      taskAwareness.length * 0.05 +
      (primaryLabel ? 0.1 : 0),
  );

  return {
    actionable,
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
