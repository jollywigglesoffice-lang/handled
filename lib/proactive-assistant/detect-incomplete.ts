import type { IncompleteAction } from "@/lib/proactive-assistant/types";
import { detectImpliedActions } from "@/lib/action-intelligence/detect-implied-actions";
import { needsCalendarContextForMessage } from "@/lib/calendar-awareness";

const ATTACH_REQUEST =
  /\b(attach|attached|send (?:me )?(?:the |a )?(?:pdf|file|document)|please send|allega(?:re)?|invia(?:re)? (?:il |la )?(?:file|documento))\b/i;

const INVOICE_REQUEST =
  /\b(send (?:me )?(?:the )?invoice|invoice (?:attached|copy)|fattura|payment details)\b/i;

const USER_PROMISED_SEND =
  /\b(i(?:'ll| will) send|i will share|ti mando|vi mando|sending (?:you )?(?:the|shortly))\b/i;

const SCHEDULING_OPEN =
  /\b(please confirm|what time|when (?:are you|can you)|propose (?:a )?time|conferma(?:re)? orario)\b/i;

export function detectIncompleteActions(
  row: { sender: string; subject: string; snippet: string },
  extraBody?: string,
  options?: {
    daysSinceMessage?: number;
    awaitingUser?: boolean;
    category?: string;
  },
): IncompleteAction[] {
  const hay = `${row.sender} ${row.subject} ${row.snippet} ${extraBody ?? ""}`.toLowerCase();
  const implied = detectImpliedActions(row, extraBody);
  const incomplete: IncompleteAction[] = [];

  if (ATTACH_REQUEST.test(hay) && USER_PROMISED_SEND.test(hay)) {
    incomplete.push({
      kind: "attachment",
      description: "Attachment or file was mentioned — confirm if you sent it",
    });
  } else if (ATTACH_REQUEST.test(hay) && (options?.awaitingUser || implied.includes("send_file"))) {
    incomplete.push({
      kind: "attachment",
      description: "They may be waiting for an attachment from you",
    });
  }

  if (INVOICE_REQUEST.test(hay) && USER_PROMISED_SEND.test(hay)) {
    incomplete.push({
      kind: "invoice",
      description: "Invoice or payment document may still be outstanding",
    });
  }

  if (
    needsCalendarContextForMessage(row, extraBody) &&
    (SCHEDULING_OPEN.test(hay) || implied.includes("scheduling"))
  ) {
    incomplete.push({
      kind: "scheduling",
      description: "Scheduling thread may still need confirmation",
    });
  }

  if (
    options?.awaitingUser &&
    (options.daysSinceMessage ?? 0) >= 1 &&
    implied.includes("reply_needed")
  ) {
    incomplete.push({
      kind: "reply",
      description: "Important thread may be waiting for your reply",
    });
  }

  if (implied.includes("approval")) {
    incomplete.push({
      kind: "approval",
      description: "Approval or sign-off may still be pending",
    });
  }

  return incomplete.slice(0, 4);
}
