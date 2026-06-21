import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { isActiveWaiting } from "@/lib/waiting-on/helpers";

/** Post-action workflow — never an inbox category. */
export type EmailWorkflowState = "waiting_on";

export type EmailWorkflowFields = {
  workflowState?: EmailWorkflowState;
  /** Who the user is waiting on (when workflowState is waiting_on). */
  waitingOnPerson?: string;
};

export function workflowFieldsFromCompletion(
  record: EmailCompletionRecord | null | undefined,
): EmailWorkflowFields {
  if (!record || !isActiveWaiting(record)) {
    return {};
  }
  return {
    workflowState: "waiting_on",
    waitingOnPerson: record.waitingOn?.trim() || undefined,
  };
}

export function isWaitingOnWorkflow(fields: EmailWorkflowFields): boolean {
  return fields.workflowState === "waiting_on";
}
