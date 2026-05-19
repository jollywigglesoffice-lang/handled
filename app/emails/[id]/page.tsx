import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { EmailDetailView, type EmailDetailPayload } from "./email-detail-view";
import { buildReplyEmailContext } from "@/lib/build-reply-email-context";
import { categorizeGmailInboxRows } from "@/lib/categorize-inbox-messages";
import { buildEmailSummary } from "@/lib/email-summary";
import { gmailGetMessageFull, gmailGetMessageMetadata } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";
import { loadCategorizationContext } from "@/lib/load-user-categorization-context";
import { analyzeFollowUp } from "@/lib/follow-up/analyze";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import { assessReplyNeed } from "@/lib/reply-necessity";
import { analyzeUnsubscribe } from "@/lib/unsubscribe/detect";
import { isLikelyHtml } from "@/lib/sanitize-email-html";
import { getEmailById, type InboxSectionTitle } from "@/lib/fake-emails";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyzeActionIntelligence } from "@/lib/action-intelligence";
import { buildCalendarAwareness } from "@/lib/calendar-awareness";
import { parseWorkflowMode, WORKFLOW_MODE_COOKIE } from "@/lib/workflow-mode";

export const dynamic = "force-dynamic";

type EmailDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function enrichGmailEmail(
  msg: Awaited<ReturnType<typeof gmailGetMessageFull>>,
  userId: string,
  workflowMode: ReturnType<typeof parseWorkflowMode>,
): Promise<EmailDetailPayload> {
  const bodyHtml = msg.bodyHtml?.trim() ?? "";
  const bodyPlain = msg.bodyText?.trim() ?? "";
  const displayPlain =
    bodyPlain && !isLikelyHtml(bodyPlain) ? bodyPlain : msg.snippet || "";

  const meta = {
    id: msg.id,
    sender: msg.sender,
    subject: msg.subject,
    snippet: msg.snippet,
    date: "",
    internalDateMs: msg.internalDateMs ?? 0,
  };

  const rulesCtx = await loadCategorizationContext(userId);
  const [categorized] = await categorizeGmailInboxRows([meta], {
    emailOverrides: rulesCtx.emailOverrides,
    senderRules: rulesCtx.senderRules,
    userRules: rulesCtx.keywordRules,
    senderRelationships: rulesCtx.senderRelationships,
    workflowMode,
  });
  const category: InboxAiCategory = categorized?.category ?? "needs_attention";
  const relationship = categorized?.relationship;

  const replyAssessment = assessReplyNeed({
    row: meta,
    category,
    workflowMode,
  });

  const aiSummary = await buildEmailSummary(meta, category, workflowMode);

  const followUpAnalysis: FollowUpAnalysis | undefined =
    analyzeFollowUp(meta, category, {
      workflowMode,
      senderRelationships: rulesCtx.senderRelationships,
    }) ?? undefined;

  const calendarAwareness = buildCalendarAwareness(meta, displayPlain);
  const actionIntelligence = analyzeActionIntelligence({
    row: meta,
    category,
    extraBody: displayPlain,
    locale: "en",
  });

  const unsubscribeAnalysis = analyzeUnsubscribe({
    bodyPlain: displayPlain,
    bodyHtml,
    snippet: msg.snippet,
    listUnsubscribe: msg.listUnsubscribe,
    listUnsubscribePost: msg.listUnsubscribePost,
    inboxCategory: category,
  });

  return {
    id: msg.id,
    section: legacySectionForCategory(category),
    sender: msg.sender,
    subject: msg.subject,
    summary: msg.snippet,
    category: inboxCategorySectionTitle(category, "en"),
    inboxCategory: category,
    aiSummary,
    followUpAnalysis,
    relationship,
    needsCalendarContext: calendarAwareness.needsCalendarContext,
    schedulingIntentDetected: calendarAwareness.schedulingIntent.detected,
    actionIntelligence,
    body: displayPlain,
    bodyHtml: bodyHtml || undefined,
    suggestedReply: "",
    replyContext: buildReplyEmailContext({
      sender: msg.sender,
      subject: msg.subject,
      body: displayPlain,
      snippet: msg.snippet,
    }),
    replyRecommended: replyAssessment.recommended,
    replySuppressedReason: replyAssessment.recommended ? undefined : replyAssessment.reason,
    suggestedTriageAction: replyAssessment.suggestedAction,
    listUnsubscribe: msg.listUnsubscribe,
    listUnsubscribePost: msg.listUnsubscribePost,
    unsubscribeAnalysis,
    unsubscribeReplyDraft: unsubscribeAnalysis.suggestedReplyText ?? undefined,
  };
}

export default async function EmailDetailPage({ params }: EmailDetailPageProps) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  const cookieStore = await cookies();
  const workflowMode = parseWorkflowMode(cookieStore.get(WORKFLOW_MODE_COOKIE)?.value);

  const mockEmail = getEmailById(id);
  if (mockEmail) {
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
    return (
      <EmailDetailView
        email={{
          ...mockEmail,
          inboxCategory: category,
          replyRecommended: replyAssessment.recommended,
          replySuppressedReason: replyAssessment.recommended
            ? undefined
            : replyAssessment.reason,
          suggestedTriageAction: replyAssessment.suggestedAction,
        }}
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    notFound();
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.provider_token;
  const userId = session?.user?.id;
  if (!accessToken || !userId) {
    notFound();
  }

  try {
    const msg = await gmailGetMessageFull(accessToken, id);
    const email = await enrichGmailEmail(msg, userId, workflowMode);
    return <EmailDetailView email={email} />;
  } catch {
    try {
      const meta = await gmailGetMessageMetadata(accessToken, id);
      const rulesCtx = await loadCategorizationContext(userId);
      const [categorized] = await categorizeGmailInboxRows([meta], {
        emailOverrides: rulesCtx.emailOverrides,
        senderRules: rulesCtx.senderRules,
        userRules: rulesCtx.keywordRules,
        senderRelationships: rulesCtx.senderRelationships,
        workflowMode,
      });
      const category = categorized?.category ?? "needs_attention";
      const relationship = categorized?.relationship;
      const replyAssessment = assessReplyNeed({ row: meta, category, workflowMode });
      const aiSummary = await buildEmailSummary(meta, category, workflowMode);
      return (
        <EmailDetailView
          email={{
            id: meta.id,
            section: legacySectionForCategory(category),
            sender: meta.sender,
            subject: meta.subject,
            summary: meta.snippet,
            category: inboxCategorySectionTitle(category, "en"),
            inboxCategory: category,
            aiSummary,
            relationship,
            body: meta.snippet,
            suggestedReply: "",
            replyRecommended: replyAssessment.recommended,
            replySuppressedReason: replyAssessment.recommended
              ? undefined
              : replyAssessment.reason,
            suggestedTriageAction: replyAssessment.suggestedAction,
            replyContext: buildReplyEmailContext({
              sender: meta.sender,
              subject: meta.subject,
              body: meta.snippet,
              snippet: meta.snippet,
            }),
          }}
        />
      );
    } catch {
      notFound();
    }
  }
}

function legacySectionForCategory(category: InboxAiCategory): InboxSectionTitle {
  if (category === "needs_attention" || category === "quick_reply") {
    return "Needs Your Attention";
  }
  if (category === "promotion" || category === "newsletter") {
    return "Hidden Inbox";
  }
  return "Handled For You";
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
