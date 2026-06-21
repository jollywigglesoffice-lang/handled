import type { AutopilotState } from "@/lib/autopilot/types";
import type { AutopilotClassifyInput } from "@/lib/autopilot/types";

const LOW_ACTION_CATEGORIES = new Set([
  "good_to_know",
  "newsletters",
  "promotions",
]);

/** Internal score only — never shown to users. */
export function computeAutopilotConfidence(input: AutopilotClassifyInput): number {
  const cat = (input.categoryConfidence ?? 0.5) * 100;
  const action = (input.actionConfidence ?? 0.55) * 100;

  let score = cat * 0.45 + action * 0.35;

  if (input.actionState === "passive") score += 12;
  if (LOW_ACTION_CATEGORIES.has(input.category)) score += 8;
  if (input.timeImpactKind === "time_free") score += 5;
  if (input.categorySource === "sender_rule") score += 6;

  if (input.actionState === "actionable") score -= 20;
  if (input.primaryLabel === "reply_needed") score -= 15;
  if (input.timeImpactKind === "time_blocker") score -= 25;
  if (input.timeImpactKind === "time_sensitive") score -= 10;
  if (input.category === "worth_your_attention") score -= 15;
  if (input.waitingResponseUpdate) score -= 30;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/** Never auto-run important or ambiguous emails. */
export function isAutopilotSafeForAuto(input: AutopilotClassifyInput): boolean {
  if (input.categorySource === "manual_override") return false;
  if (input.waitingResponseUpdate) return false;
  if (input.timeImpactKind === "time_blocker") return false;
  if (input.timeImpactKind === "time_sensitive") return false;
  if (
    input.actionState === "actionable" &&
    (input.primaryLabel === "reply_needed" || input.primaryLabel === "urgent")
  ) {
    return false;
  }
  if (input.category === "worth_your_attention") return false;
  if (!LOW_ACTION_CATEGORIES.has(input.category) && input.actionState !== "passive") {
    return false;
  }
  return true;
}

function isRoutineMail(input: AutopilotClassifyInput): boolean {
  return (
    input.actionState === "passive" ||
    LOW_ACTION_CATEGORIES.has(input.category)
  );
}

/** Map internal score → user-facing 3-state model. */
export function resolveAutopilotState(
  confidence: number,
  input: AutopilotClassifyInput,
): AutopilotState {
  const safe = isAutopilotSafeForAuto(input);

  if (!safe) {
    return confidence >= 45 ? "assisted" : "worth_your_attention";
  }

  if (confidence >= 95 && isRoutineMail(input)) {
    return "auto";
  }

  if (confidence < 45) {
    return "worth_your_attention";
  }

  return "assisted";
}
