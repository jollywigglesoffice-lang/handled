import type { UpcomingCommitment } from "@/lib/proactive-assistant/types";
import { extractTaskAwareness } from "@/lib/action-intelligence/task-awareness";
import { needsCalendarContextForMessage } from "@/lib/calendar-awareness";
import { detectStalledSignals } from "@/lib/follow-up/smart-engine/detect-stalled";

const PROMISED_USER =
  /\b(i(?:'ll| will)|we(?:'ll| will)|ti (?:mando|invio)).{0,60}(send|share|follow up|confirm|reply|pdf|document|invoice|inviare)\b/i;

const MEETING_TOMORROW =
  /\b(meeting|call|appuntamento|riunione).{0,40}(tomorrow|domani)\b|\b(tomorrow|domani).{0,40}(meeting|call|appuntamento)\b/i;

const TRAVEL =
  /\b(flight|itinerary|hotel|travel|trip to|boarding pass|check-?in|volo|hotel|viaggio)\b/i;

export function detectUpcomingCommitments(
  hay: string,
  subject: string,
  category?: string,
): UpcomingCommitment[] {
  const combined = `${subject} ${hay}`.toLowerCase();
  const tasks = extractTaskAwareness({ sender: "", subject, snippet: hay });
  const stalled = detectStalledSignals(
    { sender: "", subject, snippet: hay },
    (category as "needs_attention") ?? "needs_attention",
  );
  const out: UpcomingCommitment[] = [];

  if (PROMISED_USER.test(combined)) {
    out.push({
      kind: "promised_follow_up",
      description: "You may have promised a follow-up in this thread",
    });
  }

  for (const d of tasks) {
    if (d.kind === "date") {
      out.push({
        kind: "deadline",
        description: d.text.slice(0, 80),
        whenHint: d.when,
      });
    }
  }

  if (MEETING_TOMORROW.test(combined) || needsCalendarContextForMessage({ sender: "", subject, snippet: hay })) {
    out.push({
      kind: "meeting",
      description: MEETING_TOMORROW.test(combined)
        ? "Meeting mentioned for tomorrow"
        : "Scheduling may need your attention",
      whenHint: MEETING_TOMORROW.test(combined) ? "tomorrow" : undefined,
    });
  }

  if (stalled.pendingApproval) {
    out.push({ kind: "approval", description: "Approval may be pending" });
  }

  if (stalled.pendingPayment) {
    out.push({ kind: "payment", description: "Payment or invoice may be due" });
  }

  if (/\b(attach|pdf|document|allegato|invoice)\b/i.test(combined) && PROMISED_USER.test(combined)) {
    out.push({ kind: "attachment", description: "You mentioned sending a file or document" });
  }

  if (TRAVEL.test(combined)) {
    out.push({ kind: "meeting", description: "Travel-related details in this thread" });
  }

  return out.slice(0, 5);
}
