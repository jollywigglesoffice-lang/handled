import type { GmailInboxRow } from "@/lib/gmail-api";
import { getAiApiKey } from "@/lib/ai-api-key";
import {
  callOpenRouterChat,
  readOpenRouterChatContent,
  REPLY_MODEL,
} from "@/lib/openrouter-reply";
import { followUpDraftTone } from "@/lib/follow-up/smart-engine";
import type { ConversationState } from "@/lib/follow-up/types";
import { senderFirstNameFromRow } from "@/lib/follow-up/format";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export async function generateFollowUpDraft(input: {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  state: ConversationState;
  userName?: string;
  relationship?: SenderRelationshipProfile | null;
}): Promise<string> {
  const name = senderFirstNameFromRow(input.row.sender);
  const signOff = input.userName?.trim() || "Best";
  const tone = followUpDraftTone(input.relationship);

  const heuristic = heuristicFollowUpDraft(
    input.state,
    name,
    input.row.subject,
    signOff,
    tone.openerExamples[0],
  );

  const apiKey = getAiApiKey();
  if (!apiKey) return heuristic;

  const stateGuide: Record<ConversationState, string> = {
    awaiting_your_reply: "The recipient is waiting for the user's reply. Draft a helpful, complete response.",
    waiting_for_response: "The user is waiting on the recipient. Draft a polite, brief follow-up nudge.",
    follow_up_recommended: "Draft a warm follow-up to move the conversation forward.",
    pending_scheduling: "Draft a reply that helps confirm or propose a meeting time.",
    user_commitment_pending:
      "The user may owe something they promised. Draft a friendly message delivering or acknowledging the commitment.",
    conversation_unresolved: "Draft a clear, calm reply that addresses the open thread.",
    awaiting_approval: "Draft a clear approval or decline — calm and decisive.",
    pending_payment: "Draft a brief note acknowledging the invoice or payment — factual, calm.",
  };

  try {
    const response = await callOpenRouterChat(apiKey, {
      model: REPLY_MODEL,
      messages: [
        {
          role: "system",
          content:
            `You write short email follow-ups. ${tone.style} Never pushy or anxiety-inducing. Prefer openers like: ${tone.openerExamples.join(" / ")}. Output ONLY the email body (greeting through sign-off). No markdown.`,
        },
        {
          role: "user",
          content: [
            `State: ${input.state}`,
            `Guidance: ${stateGuide[input.state]}`,
            `From: ${input.row.sender}`,
            `Subject: ${input.row.subject}`,
            `Snippet: ${input.row.snippet}`,
            `User sign-off name: ${signOff}`,
            "Keep under 90 words.",
          ].join("\n"),
        },
      ],
      temperature: 0.45,
    });

    const { content } = await readOpenRouterChatContent(response);
    const text = content?.trim();
    if (text && text.length > 20) return text;
  } catch {
    // fallback
  }

  return heuristic;
}

function heuristicFollowUpDraft(
  state: ConversationState,
  name: string,
  subject: string,
  signOff: string,
  opener = "Just checking in regarding",
): string {
  const subj = subject ? ` ${subject}` : "";

  switch (state) {
    case "waiting_for_response":
    case "follow_up_recommended":
      return `Hi ${name},

${opener}${subj} — any updates when you have a moment? No rush at all.

${signOff}`;
    case "pending_scheduling":
      return `Hi ${name},

Thanks for reaching out about scheduling${subj}. I'm flexible this week — would any of these times work on your end, or should I suggest a few options?

${signOff}`;
    case "user_commitment_pending":
      return `Hi ${name},

Thanks for your patience${subj}. I'm putting together what we discussed and will send it shortly. Let me know if anything has changed on your side.

${signOff}`;
    case "awaiting_approval":
      return `Hi ${name},

Thank you for your note${subj}. I've reviewed it and will confirm my decision shortly.

${signOff}`;
    case "pending_payment":
      return `Hi ${name},

Thanks for sending this${subj}. I'll review the payment details and follow up if anything is needed.

${signOff}`;
    case "awaiting_your_reply":
    case "conversation_unresolved":
    default:
      return `Hi ${name},

Thank you for your message${subj}. I've reviewed this and will get back to you with a clear answer shortly.

${signOff}`;
  }
}
