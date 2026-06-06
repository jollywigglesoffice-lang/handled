import { followUpDraftTone } from "@/lib/follow-up/smart-engine/relationship-tone";
import { senderFirstNameFromRow } from "@/lib/follow-up/format";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

/** Offline-safe follow-up draft for Waiting On — relationship-aware, never pushy. */
export function buildWaitingFollowUpDraft(input: {
  record: EmailCompletionRecord;
  userName?: string;
  relationship?: SenderRelationshipProfile | null;
  locale?: "en" | "it";
}): string {
  const locale = input.locale ?? "en";
  const who = input.record.waitingOn?.trim();
  const name = who
    ? who.split(/\s+/)[0] ?? who
    : senderFirstNameFromRow(input.record.sender);
  const signOff = input.userName?.trim() || (locale === "it" ? "Grazie" : "Thanks");
  const tone = followUpDraftTone(input.relationship);
  const opener = tone.openerExamples[0] ?? "Just checking in regarding";

  if (locale === "it") {
    if (input.relationship?.kind === "school" || input.relationship?.kind === "family") {
      return `Ciao ${name},

${opener} la mia email precedente${input.record.subject ? ` (${input.record.subject})` : ""}.

Fammi sapere se ti serve qualcosa da parte mia.

${signOff}!`;
    }

    return `Ciao ${name},

${opener} la mia email precedente.

Fammi sapere se ti serve qualcosa da parte mia.

${signOff}!`;
  }

  if (input.relationship?.kind === "school" || input.relationship?.kind === "family") {
    return `Hi ${name},

${opener} my previous email${input.record.subject ? ` about ${input.record.subject}` : ""}.

Let me know if you need anything from me.

${signOff}!`;
  }

  return `Hi ${name},

Just checking in regarding my previous email.

Let me know if you need anything from me.

${signOff}!`;
}
