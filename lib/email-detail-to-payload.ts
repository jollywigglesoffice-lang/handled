import type { EmailDetailPayload } from "@/app/emails/[id]/email-detail-view";
import { buildReplyEmailContext } from "@/lib/build-reply-email-context";

/** API / minimal loader shape → full EmailDetailPayload (no enrichment). */
export type EmailDetailApiShape = {
  id: string;
  sender: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  bodyPlain?: string;
  summary?: string;
  section?: EmailDetailPayload["section"];
  category?: string;
  aiSummary?: string;
  suggestedReply?: string;
  inboxCategory?: EmailDetailPayload["inboxCategory"];
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
};

export function toEmailDetailPayload(raw: EmailDetailApiShape): EmailDetailPayload {
  const bodyPlain = raw.bodyPlain?.trim() || raw.body?.trim() || "";
  return {
    id: raw.id,
    section: raw.section ?? "Needs Your Attention",
    sender: raw.sender,
    subject: raw.subject,
    summary: raw.summary ?? raw.body?.slice(0, 240) ?? "",
    category: raw.category ?? "Email",
    aiSummary: raw.aiSummary ?? raw.summary ?? raw.body?.slice(0, 500) ?? "",
    body: bodyPlain,
    bodyHtml: raw.bodyHtml,
    suggestedReply: raw.suggestedReply ?? "",
    inboxCategory: raw.inboxCategory ?? "worth_your_attention",
    listUnsubscribe: raw.listUnsubscribe,
    listUnsubscribePost: raw.listUnsubscribePost,
    replyContext: buildReplyEmailContext({
      sender: raw.sender,
      subject: raw.subject,
      body: bodyPlain,
      snippet: raw.summary ?? raw.body,
    }),
    replyRecommended: true,
  };
}
