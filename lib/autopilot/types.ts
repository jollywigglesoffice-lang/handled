import type { CompletionActionId } from "@/lib/completion-actions/types";

/** User-facing autopilot posture — no numeric levels exposed. */
export type AutopilotState = "auto" | "assisted" | "worth_your_attention";

export type AutopilotLogAction =
  | "archived"
  | "categorized"
  | "scheduled"
  | "marked_read"
  | "no_action";

/** Slim summary attached to inbox messages — no confidence scores in UI. */
export type AutopilotSummary = {
  state: AutopilotState;
  suggestedActionId: CompletionActionId;
  suggestedActionLabel: string;
  /** Plain-language explanation shown in log */
  reason: string;
  /** What rule or signal drove the decision */
  ruleTriggered: string;
  /** Internal: only true when safe to run without confirmation */
  canAutoRun: boolean;
};

/** One traceable log row — every automated or confirmed action. */
export type HandledLogEntry = {
  id: string;
  at: string;
  emailId: string;
  accountId?: string;
  sender: string;
  subject: string;
  mode: "auto" | "assisted";
  actionTaken: string;
  actionId: CompletionActionId;
  category: string;
  reason: string;
  ruleTriggered: string;
  reversible: true;
};

export type HandledLogStats = {
  totalHandled: number;
  handledForYou: number;
  suggestedConfirmed: number;
  entries: HandledLogEntry[];
};

export type AutopilotClassifyInput = {
  row: { sender: string; subject: string; snippet?: string };
  category: string;
  categoryConfidence?: number;
  categorySource?: string;
  actionConfidence?: number;
  actionState?: "actionable" | "waiting_response" | "passive";
  primaryLabel?: string | null;
  timeImpactKind?: "time_blocker" | "time_sensitive" | "time_free";
  waitingResponseUpdate?: boolean;
  locale?: "en" | "it";
};
