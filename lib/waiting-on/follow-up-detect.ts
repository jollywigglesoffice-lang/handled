import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { FOLLOW_UP_PRESETS } from "@/lib/waiting-on/types";
import {
  daysWaiting,
  hasWaitingResponse,
  isActiveWaiting,
} from "@/lib/waiting-on/helpers";

export type WaitingFollowUpMilestone = (typeof FOLLOW_UP_PRESETS)[number];

export type WaitingFollowUpSignal = {
  mayNeedFollowUp: boolean;
  daysWaiting: number;
  /** Highest day threshold reached (3, 7, or 14). */
  milestoneDays: WaitingFollowUpMilestone | null;
};

function milestoneForDays(days: number): WaitingFollowUpMilestone | null {
  if (days >= 14) return 14;
  if (days >= 7) return 7;
  if (days >= 3) return 3;
  return null;
}

/** Unresolved Waiting On items past 3/7/14 days — suggest follow-up only, never auto-send. */
export function detectWaitingFollowUp(
  record: EmailCompletionRecord,
  now = Date.now(),
): WaitingFollowUpSignal {
  if (!isActiveWaiting(record) || hasWaitingResponse(record)) {
    return { mayNeedFollowUp: false, daysWaiting: 0, milestoneDays: null };
  }

  const days = daysWaiting(record, now);
  const milestoneDays = milestoneForDays(days);

  return {
    mayNeedFollowUp: milestoneDays != null,
    daysWaiting: days,
    milestoneDays,
  };
}
