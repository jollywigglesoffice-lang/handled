import type { GmailInboxRow } from "@/lib/gmail-api";
import { hasSoftSchedulingIntent } from "@/lib/explicit-email-signals";
import { schedulingHaystack } from "@/lib/calendar-awareness/detect-scheduling-intent";

/** Soft time intent — nudge only, no calendar UI or slot assumptions. */
export function detectSoftSchedulingIntent(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): boolean {
  const hay = schedulingHaystack(row, extraBody);
  return hasSoftSchedulingIntent(hay);
}
