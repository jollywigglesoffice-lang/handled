import type { CompletionActionId } from "@/lib/completion-actions/types";
import { scopedEmailKey } from "@/lib/gmail/account-types";
import { applyDoneInboxEffects } from "@/lib/inbox-truth/apply-done";
import { trackEvent } from "@/lib/analytics";
import type { AutopilotSummary } from "@/lib/autopilot/types";
import {
  appendHandledLogEntry,
  isAutopilotProcessed,
  markAutopilotProcessed,
} from "@/lib/autopilot/log-storage";

export type AutopilotEmail = {
  id: string;
  accountId?: string;
  sender: string;
  subject: string;
  snippet: string;
  category: string;
  threadId?: string;
  accountEmail?: string;
  accountLabel?: string;
  autopilot?: AutopilotSummary;
};

export type AutopilotExecuteInput = {
  emails: AutopilotEmail[];
  locale: "en" | "it";
  completeEmails: (
    inputs: Array<{
      emailId: string;
      actionId: CompletionActionId;
      actionLabel: string;
      sender: string;
      subject: string;
      snippet: string;
      category: string;
      threadId?: string;
      accountId?: string;
      accountEmail?: string;
      accountLabel?: string;
    }>,
    options: { locale: "en" | "it" },
  ) => Promise<unknown>;
};

/** Log when user confirms an assisted suggestion. */
export function logAssistedConfirmation(
  email: AutopilotEmail,
  actionId: CompletionActionId,
  actionLabel: string,
  locale: "en" | "it",
): void {
  const ap = email.autopilot;
  if (!ap || ap.state !== "assisted") return;

  appendHandledLogEntry({
    emailId: email.id,
    accountId: email.accountId,
    sender: email.sender,
    subject: email.subject,
    mode: "assisted",
    actionTaken: actionLabel,
    actionId,
    category: email.category,
    reason: ap.reason,
    ruleTriggered: ap.ruleTriggered,
  });

  trackEvent("autopilot_batch_processed", {
    count: 1,
    mode: "assisted",
  });
}

/**
 * Auto-run only AUTO-state routine mail.
 * Every action is logged individually — nothing hidden.
 */
export async function runAutopilotBatch(input: AutopilotExecuteInput): Promise<number> {
  const autoEmails: AutopilotEmail[] = [];

  for (const email of input.emails) {
    const ap = email.autopilot;
    if (!ap?.canAutoRun || ap.state !== "auto") continue;
    const key = scopedEmailKey(email.id, email.accountId);
    if (isAutopilotProcessed(key)) continue;
    autoEmails.push(email);
  }

  if (!autoEmails.length) return 0;

  await input.completeEmails(
    autoEmails.map((e) => ({
      emailId: e.id,
      actionId: e.autopilot!.suggestedActionId,
      actionLabel: e.autopilot!.suggestedActionLabel,
      sender: e.sender,
      subject: e.subject,
      snippet: e.snippet,
      category: e.category,
      threadId: e.threadId,
      accountId: e.accountId,
      accountEmail: e.accountEmail,
      accountLabel: e.accountLabel,
    })),
    { locale: input.locale },
  );

  applyDoneInboxEffects(
    autoEmails.map((e) => ({ id: e.id, accountId: e.accountId })),
    { actionId: "no_action_needed" },
  );

  for (const email of autoEmails) {
    const ap = email.autopilot!;
    appendHandledLogEntry({
      emailId: email.id,
      accountId: email.accountId,
      sender: email.sender,
      subject: email.subject,
      mode: "auto",
      actionTaken: ap.suggestedActionLabel,
      actionId: ap.suggestedActionId,
      category: email.category,
      reason: ap.reason,
      ruleTriggered: ap.ruleTriggered,
    });
    markAutopilotProcessed([scopedEmailKey(email.id, email.accountId)]);
  }

  trackEvent("autopilot_batch_processed", {
    count: autoEmails.length,
    mode: "auto",
  });

  return autoEmails.length;
}
