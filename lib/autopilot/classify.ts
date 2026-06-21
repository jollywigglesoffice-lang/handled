import type { CompletionActionId } from "@/lib/completion-actions/types";
import { completionLabelForActionState } from "@/lib/email-action-state-copy";
import {
  computeAutopilotConfidence,
  isAutopilotSafeForAuto,
  resolveAutopilotState,
} from "@/lib/autopilot/score";
import type { AutopilotClassifyInput, AutopilotState, AutopilotSummary } from "@/lib/autopilot/types";

const LOW_ACTION = new Set(["good_to_know", "newsletters", "promotions"]);

function resolveSuggestedAction(
  input: AutopilotClassifyInput,
  state: AutopilotState,
): { id: CompletionActionId; label: string } {
  const locale = input.locale ?? "en";
  const passiveLabel = completionLabelForActionState(
    "no_action_needed",
    locale === "it" ? "Nessuna azione" : "No action needed",
    locale,
    input.actionState === "passive" ? "passive" : undefined,
  );

  if (state === "auto" || input.actionState === "passive") {
    return { id: "no_action_needed", label: passiveLabel };
  }

  if (input.primaryLabel === "reply_needed" || input.category === "worth_your_attention") {
    return {
      id: "replied",
      label: locale === "it" ? "Rispondi" : "Reply",
    };
  }

  if (input.timeImpactKind === "time_sensitive") {
    return {
      id: "took_action",
      label: locale === "it" ? "Agisci" : "Take action",
    };
  }

  if (LOW_ACTION.has(input.category)) {
    return { id: "no_action_needed", label: passiveLabel };
  }

  if (state === "worth_your_attention") {
    return {
      id: "took_action",
      label: locale === "it" ? "Rivedi" : "Review",
    };
  }

  return {
    id: "saved_for_reference",
    label: locale === "it" ? "Salva" : "Save",
  };
}

function resolveReason(input: AutopilotClassifyInput, state: AutopilotState): string {
  const it = input.locale === "it";
  if (state === "auto") {
    if (input.actionState === "passive") {
      return it ? "Solo informativa — nessuna azione richiesta" : "Informational only — no action needed";
    }
    return it ? "Bassa priorità — archiviata automaticamente" : "Low priority — archived automatically";
  }
  if (state === "assisted") {
    return it ? "Handled ha un suggerimento — conferma tu" : "Handled has a suggestion — you confirm";
  }
  if (input.timeImpactKind === "time_blocker") {
    return it ? "Programmazione da decidere" : "Scheduling needs your decision";
  }
  if (input.primaryLabel === "reply_needed") {
    return it ? "Potrebbe servire una risposta" : "May need a reply";
  }
  return it ? "Handled non è sicuro — rivedi tu" : "Handled isn't sure — please review";
}

function resolveRuleTriggered(input: AutopilotClassifyInput): string {
  const it = input.locale === "it";
  if (input.categorySource === "sender_rule") {
    return it ? "Regola mittente" : "Sender rule";
  }
  if (input.categorySource === "manual_override") {
    return it ? "Modifica manuale" : "Manual change";
  }
  if (input.timeImpactKind === "time_blocker") {
    return it ? "Protezione calendario" : "Calendar safety";
  }
  if (LOW_ACTION.has(input.category)) {
    return it ? "Categoria a bassa priorità" : "Low-priority category";
  }
  if (input.actionState === "passive") {
    return it ? "Email informativa" : "Informational email";
  }
  return it ? "Ordinamento inbox" : "Inbox sorting";
}

export function classifyAutopilot(input: AutopilotClassifyInput): AutopilotSummary {
  const confidence = computeAutopilotConfidence(input);
  const state = resolveAutopilotState(confidence, input);
  const safe = isAutopilotSafeForAuto(input);
  const suggested = resolveSuggestedAction(input, state);

  return {
    state,
    suggestedActionId: suggested.id,
    suggestedActionLabel: suggested.label,
    reason: resolveReason(input, state),
    ruleTriggered: resolveRuleTriggered(input),
    canAutoRun: safe && state === "auto",
  };
}

/** Inbox shows assisted + worth_your_attention only. Auto never appears. */
export function isAutopilotInboxVisible(autopilot?: AutopilotSummary): boolean {
  if (!autopilot) return true;
  return autopilot.state === "assisted" || autopilot.state === "worth_your_attention";
}
