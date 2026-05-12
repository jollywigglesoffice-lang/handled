import { notFound } from "next/navigation";
import { EmailDetailView } from "./email-detail-view";
import { getEmailById, type FakeEmail } from "@/lib/fake-emails";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gmailGetMessageFull } from "@/lib/gmail-api";

export const dynamic = "force-dynamic";

type EmailDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function gmailToFakeEmail(
  msg: Awaited<ReturnType<typeof gmailGetMessageFull>>,
): FakeEmail {
  return {
    id: msg.id,
    section: "Needs Your Attention",
    sender: msg.sender,
    subject: msg.subject,
    summary: msg.snippet,
    category: "Gmail",
    aiSummary: msg.snippet || "Open the message below for the full content.",
    body: msg.bodyText,
    suggestedReply: "",
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
    return <EmailDetailView email={gmailToFakeEmail(msg)} />;
  } catch {
    notFound();
  }
}
