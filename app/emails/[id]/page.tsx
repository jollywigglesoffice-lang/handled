import { EmailDetailClientLoader } from "./email-detail-client-loader";
import { EmailDetailErrorBoundary } from "./email-detail-error-boundary";
import { EmailDetailView } from "./email-detail-view";
import { EmailDetailVisibleError } from "./email-detail-visible-error";
import { getEmailById } from "@/lib/fake-emails";
import { toEmailDetailPayload } from "@/lib/email-detail-to-payload";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { assessReplyNeed } from "@/lib/reply-necessity";
import { parseWorkflowMode, WORKFLOW_MODE_COOKIE } from "@/lib/workflow-mode";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type EmailDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EmailDetailPage({ params }: EmailDetailPageProps) {
  try {
    const resolved = await params;
    console.log("EMAIL ID:", resolved.id);

    const rawId = resolved.id ?? "";
    const id = decodeURIComponent(rawId).trim();

    if (!id) {
      console.error("[email-detail] empty id after decode");
      return (
        <EmailDetailVisibleError error={new Error("Route param id is empty")} />
      );
    }

    console.log("[email-detail] before auth check (server)");
    console.log("[email-detail] skipped on server: workflow, identity, memory, brain");

    const mockEmail = getEmailById(id);
    if (mockEmail) {
      console.log("[email-detail] mock email found", { id });
      const cookieStore = await cookies();
      const workflowMode = parseWorkflowMode(cookieStore.get(WORKFLOW_MODE_COOKIE)?.value);
      const category = normalizeMockCategory(mockEmail);
      const replyAssessment = assessReplyNeed({
        row: {
          sender: mockEmail.sender,
          subject: mockEmail.subject,
          snippet: mockEmail.summary,
        },
        category,
        workflowMode,
      });
      const email = toEmailDetailPayload({
        ...mockEmail,
        inboxCategory: category,
      });
      email.replyRecommended = replyAssessment.recommended;
      email.replySuppressedReason = replyAssessment.recommended
        ? undefined
        : replyAssessment.reason;
      email.suggestedTriageAction = replyAssessment.suggestedAction;
      email.replyContext =
        email.replyContext ??
        `${mockEmail.sender}\n${mockEmail.subject}\n\n${mockEmail.body}`;
      console.log("[email-detail] before render (mock EmailDetailView + EmailActions)");
      return <EmailDetailView email={email} showActions enrichmentEnabled />;
    }

    console.log("[email-detail] gmail id — delegating to client loader (inbox fetch pattern)");
    console.log("[email-detail] before render (client loader)");

    return (
      <EmailDetailErrorBoundary>
        <EmailDetailClientLoader emailId={id} />
      </EmailDetailErrorBoundary>
    );
  } catch (error) {
    console.error("EMAIL DETAIL LOAD ERROR:", error);
    return <EmailDetailVisibleError error={error} />;
  }
}

function normalizeMockCategory(
  email: ReturnType<typeof getEmailById>,
): InboxAiCategory {
  if (!email) return "needs_attention";
  const s = email.section.toLowerCase();
  if (s.includes("promotion")) return "promotion";
  if (s.includes("newsletter")) return "newsletter";
  if (s.includes("handled")) return "handled";
  if (s.includes("quick")) return "quick_reply";
  return "needs_attention";
}
