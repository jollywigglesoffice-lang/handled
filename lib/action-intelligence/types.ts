import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Implied action detected in email text (internal). */
export type ImpliedActionKind =
  | "reply_needed"
  | "follow_up"
  | "waiting_on_them"
  | "waiting_on_you"
  | "deadline"
  | "payment"
  | "review"
  | "meeting"
  | "urgent"
  | "send_file"
  | "approval"
  | "scheduling"
  | "reminder";

/** Calm user-facing labels (max 1 primary on inbox). */
export type ActionLabelId =
  | "reply_needed"
  | "follow_up"
  | "waiting"
  | "deadline"
  | "payment"
  | "review"
  | "meeting"
  | "urgent";

export type TaskAwarenessItem = {
  kind: "date" | "promise" | "commitment" | "requested_action";
  text: string;
  /** Parsed hint e.g. "Friday", "tomorrow" */
  when?: string;
};

export type SafeReminderSuggestion = {
  id: string;
  message: string;
  /** Suggested remind time (ISO) — user must opt in; never auto-fired */
  suggestedAt?: string;
  kind: "follow_up" | "deadline" | "waiting" | "reply";
  requiresUserApproval: true;
};

/** Tri-state posture for what the user should do with this email. */
export type EmailActionState = "actionable" | "waiting_response" | "passive";

export type ActionIntelligenceResult = {
  actionable: boolean;
  actionState: EmailActionState;
  impliedActions: ImpliedActionKind[];
  labels: ActionLabelId[];
  primaryLabel: ActionLabelId | null;
  suggestedNextAction: string | null;
  taskAwareness: TaskAwarenessItem[];
  safeReminders: SafeReminderSuggestion[];
  confidence: number;
};

/** Slim shape for inbox list API */
export type ActionIntelligenceSummary = {
  actionable: boolean;
  actionState: EmailActionState;
  primaryLabel: ActionLabelId | null;
  suggestedNextAction: string | null;
};

export type AnalyzeActionIntelligenceInput = {
  row: {
    sender: string;
    subject: string;
    snippet?: string;
    internalDateMs?: number;
  };
  category?: InboxAiCategory;
  extraBody?: string;
  locale?: "en" | "it";
};

/** Future: plug Calendar, Tasks, CRM memory */
export type ActionIntegrationId =
  | "google_calendar"
  | "tasks"
  | "follow_up_tracking"
  | "smart_reminders"
  | "crm_memory";

export type ActionIntegrationStatus = "available" | "planned" | "connected";

export type ActionIntegrationDescriptor = {
  id: ActionIntegrationId;
  status: ActionIntegrationStatus;
  description: string;
};
