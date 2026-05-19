import type { GmailInboxRow } from "@/lib/gmail-api";
import { getAiApiKey } from "@/lib/ai-api-key";
import {
  callOpenRouterChat,
  readOpenRouterChatContent,
  REPLY_MODEL,
} from "@/lib/openrouter-reply";
import type { ConversationState } from "@/lib/follow-up/types";
import { senderFirstNameFromRow } from "@/lib/follow-up/format";

export async function generateFollowUpDraft(input: {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  state: ConversationState;
  userName?: string;
}): Promise<string> {
  const name = senderFirstNameFromRow(input.row.sender);
  const signOff = input.userName?.trim() || "Best";

  const heuristic = heuristicFollowUpDraft(input.state, name, input.row.subject, signOff);

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
  };

  try {
    const response = await callOpenRouterChat(apiKey, {
      model: REPLY_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You write short, warm professional email follow-ups. Tone: supportive, calm, organized — never pushy or anxiety-inducing. Output ONLY the email body (greeting through sign-off). No markdown.",
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
): string {
  const subj = subject ? ` regarding “${subject}”` : "";

  switch (state) {
    case "waiting_for_response":
    case "follow_up_recommended":
      return `Hi ${name},

Just following up${subj} — wanted to check whether you had a chance to look this over. No rush at all; happy to adjust if timing isn't right.

${signOff}`;
    case "pending_scheduling":
      return `Hi ${name},

Thanks for reaching out about scheduling${subj}. I'm flexible this week — would any of these times work on your end, or should I suggest a few options?

${signOff}`;
    case "user_commitment_pending":
      return `Hi ${name},

Thanks for your patience${subj}. I'm putting together what we discussed and will send it shortly. Let me know if anything has changed on your side.

${signOff}`;
    case "awaiting_your_reply":
    case "conversation_unresolved":
    default:
      return `Hi ${name},

Thank you for your message${subj}. I've reviewed this and will get back to you with a clear answer shortly.

${signOff}`;
  }
}
