import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { assessReplyNeed, type ReplyNeedAssessment } from "@/lib/reply-necessity";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";

export type SmartReplyInput = {
  sender: string;
  subject: string;
  snippet: string;
  category: InboxAiCategory;
};

export function assessSmartReply(input: SmartReplyInput): ReplyNeedAssessment {
  return assessReplyNeed({
    row: {
      sender: input.sender,
      subject: input.subject,
      snippet: input.snippet,
    },
    category: input.category,
    workflowMode: readWorkflowModeFromStorage(),
  });
}

export function shouldOfferSmartReply(input: SmartReplyInput): boolean {
  return assessSmartReply(input).recommended;
}

export function smartReplyInputFromMessage(message: GmailCardMessage): SmartReplyInput {
  return {
    sender: message.sender,
    subject: message.subject,
    snippet: message.snippet,
    category: message.category,
  };
}
