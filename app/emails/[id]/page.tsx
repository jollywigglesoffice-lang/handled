import { notFound } from "next/navigation";
import { EmailDetailView, type EmailDetailPayload } from "./email-detail-view";
import { buildReplyEmailContext } from "@/lib/build-reply-email-context";
import { isLikelyHtml } from "@/lib/sanitize-email-html";
import { getEmailById } from "@/lib/fake-emails";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gmailGetMessageFull } from "@/lib/gmail-api";

export const dynamic = "force-dynamic";

type EmailDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function gmailToDetailEmail(
  msg: Awaited<ReturnType<typeof gmailGetMessageFull>>,
): EmailDetailPayload {
  const bodyHtml = msg.bodyHtml?.trim() ?? "";
  const bodyPlain = msg.bodyText?.trim() ?? "";
  const displayPlain =
    bodyPlain && !isLikelyHtml(bodyPlain) ? bodyPlain : msg.snippet || "";

  return {
    id: msg.id,
    section: "Needs Your Attention",
    sender: msg.sender,
    subject: msg.subject,
    summary: msg.snippet,
    category: "Gmail",
    aiSummary: msg.snippet || "Open the message below for the full content.",
    body: displayPlain,
    bodyHtml: bodyHtml || undefined,
    suggestedReply: "",
    replyContext: buildReplyEmailContext({
      sender: msg.sender,
      subject: msg.subject,
      body: displayPlain,
      snippet: msg.snippet,
    }),
  };
}

export default async function EmailDetailPage({ params }: EmailDetailPageProps) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  const mockEmail = getEmailById(id);
  if (mockEmail) {
    return <EmailDetailView email={mockEmail} />;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    notFound();
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.provider_token;
  if (!accessToken) {
    notFound();
  }

  try {
    const msg = await gmailGetMessageFull(accessToken, id);
    return <EmailDetailView email={gmailToDetailEmail(msg)} />;
  } catch {
    notFound();
  }
}
