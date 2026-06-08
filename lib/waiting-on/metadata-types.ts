/**
 * Workflow metadata stored separately from completion history.
 * Foundation for reminders, calendar sync, and recurring follow-ups.
 */
export type WaitingWorkflowStatus = "waiting" | "followed_up" | "resolved";

export type WaitingOnMetadata = {
  emailId: string;
  /** User note — not part of completion history. */
  note?: string;
  workflowStatus: WaitingWorkflowStatus;
  /** Explicit follow-up date (overrides completion-derived followUpAt when set). */
  followUpAt?: number;
  /** When the user last sent or marked a follow-up. */
  followedUpAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type WaitingOnMetadataMap = Record<string, WaitingOnMetadata>;

export type WaitingDashboardSummary = {
  total: number;
  overdue: number;
  longestDays: number;
};

export type WaitingDashboardItem = {
  emailId: string;
  subject: string;
  sender: string;
  waitingOn: string;
  waitingSinceMs: number;
  daysWaiting: number;
  followUpAt?: number;
  note?: string;
  workflowStatus: WaitingWorkflowStatus;
  isOverdue: boolean;
  isUrgent: boolean;
};
