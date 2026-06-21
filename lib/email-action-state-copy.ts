import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { EmailActionState } from "@/lib/action-intelligence/types";

const COPY = {
  en: {
    passiveAwareness: "No action needed",
    noActionPassive: "No action needed",
  },
  it: {
    passiveAwareness: "Nessuna azione necessaria",
    noActionPassive: "Nessuna azione necessaria",
  },
} as const;

export function passiveAwarenessLabel(locale: "en" | "it"): string {
  return COPY[locale].passiveAwareness;
}

/** Context-aware label for the no_action_needed completion action. */
export function completionLabelForActionState(
  actionId: CompletionActionId,
  catalogLabel: string,
  locale: "en" | "it",
  actionState?: EmailActionState,
): string {
  if (actionId === "no_action_needed" && actionState === "passive") {
    return COPY[locale].noActionPassive;
  }
  return catalogLabel;
}
