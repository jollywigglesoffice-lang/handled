import type { EmailDetailPayload } from "@/app/emails/[id]/email-detail-view";
import { buildReplyEmailContext } from "@/lib/build-reply-email-context";
import {
  enrichEmailDetailIntelligence,
  toEnrichmentMeta,
} from "@/lib/email-detail-enrichment";
import { gmailGetMessageFull, gmailGetMessageMetadata } from "@/lib/gmail-api";

type GmailMessageFull = Awaited<ReturnType<typeof gmailGetMessageFull>>;
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";
import { assessReplyNeed } from "@/lib/reply-necessity";
import { heuristicEmailSummary } from "@/lib/email-summary";
import { isLikelyHtml } from "@/lib/sanitize-email-html";
import type { InboxSectionTitle } from "@/lib/fake-emails";
import { parseWorkflowMode, type WorkflowMode } from "@/lib/workflow-mode";

function legacySectionForCategory(category: InboxAiCategory): InboxSectionTitle {
  if (category === "needs_attention" || category === "quick_reply") {
    return "Needs Your Attention";
  }
  if (category === "promotion" || category === "newsletter") {
    return "Hidden Inbox";
  }
  return "Handled For You";
}

export async function buildEmailDetailFromGmailMessage(
  msg: GmailMessageFull,
  userId: string,
  workflowMode: WorkflowMode,
): Promise<EmailDetailPayload> {
  const bodyHtml = msg.bodyHtml?.trim() ?? "";
  const bodyPlain = msg.bodyText?.trim() ?? "";
  const displayPlain =
    bodyPlain && !isLikelyHtml(bodyPlain) ? bodyPlain : msg.snippet || "";

  const meta = toEnrichmentMeta({
    id: msg.id,
    threadId: msg.threadId,
    sender: msg.sender,
    subject: msg.subject,
    snippet: msg.snippet,
    internalDateMs: msg.internalDateMs,
  });

  const intel = await enrichEmailDetailIntelligence(meta, userId, workflowMode, {
    displayPlain,
    bodyHtml,
    listUnsubscribe: msg.listUnsubscribe,
    listUnsubscribePost: msg.listUnsubscribePost,
    locale: "en",
  });

  const row = {
    id: meta.id,
    threadId: meta.threadId,
    sender: meta.sender,
    subject: meta.subject,
    snippet: meta.snippet,
    date: meta.date,
    internalDateMs: meta.internalDateMs,
  };

  const replyAssessment = assessReplyNeed({
    row,
    category: intel.category,
    workflowMode,
  });

  return {
    id: msg.id,
    section: legacySectionForCategory(intel.category),
    sender: msg.sender,
    subject: msg.subject,
    summary: msg.snippet,
    category: inboxCategorySectionTitle(intel.category, "en"),
    inboxCategory: intel.category,
    aiSummary: intel.aiSummary,
    followUpAnalysis: intel.followUpAnalysis,
    relationship: intel.relationship,
    needsCalendarContext: intel.calendarAwareness?.needsCalendarContext ?? false,
    schedulingIntentDetected:
      intel.calendarAwareness?.schedulingIntent?.detected ?? false,
    actionIntelligence: intel.actionIntelligence,
    timelineIntelligence: intel.timelineIntelligence,
    proactiveAssistant: intel.proactiveAssistant,
    decisionAssistance: intel.decisionAssistance,
    enrichmentWarnings: intel.enrichmentWarnings,
    body: displayPlain,
    bodyPlain: displayPlain,
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
    unsubscribeAnalysis: intel.unsubscribeAnalysis,
    unsubscribeReplyDraft: intel.unsubscribeAnalysis?.suggestedReplyText ?? undefined,
  };
}

export async function buildEmailDetailFromGmailMetadata(
  accessToken: string,
  id: string,
  userId: string,
  workflowMode: WorkflowMode,
): Promise<EmailDetailPayload> {
  const meta = await gmailGetMessageMetadata(accessToken, id);
  const enrichmentMeta = toEnrichmentMeta(meta);
  const intel = await enrichEmailDetailIntelligence(
    enrichmentMeta,
    userId,
    workflowMode,
    { displayPlain: meta.snippet, locale: "en" },
  );
  const category = intel.category;
  const replyAssessment = assessReplyNeed({
    row: enrichmentMeta,
    category,
    workflowMode,
  });
  const aiSummary = intel.aiSummary || heuristicEmailSummary(enrichmentMeta, category);

  return {
    id: meta.id,
    section: legacySectionForCategory(category),
    sender: meta.sender,
    subject: meta.subject,
    summary: meta.snippet,
    category: inboxCategorySectionTitle(category, "en"),
    inboxCategory: category,
    aiSummary,
    relationship: intel.relationship,
    actionIntelligence: intel.actionIntelligence,
    timelineIntelligence: intel.timelineIntelligence,
    proactiveAssistant: intel.proactiveAssistant,
    decisionAssistance: intel.decisionAssistance,
    enrichmentWarnings: intel.enrichmentWarnings,
    body: meta.snippet,
    suggestedReply: "",
    replyRecommended: replyAssessment.recommended,
    replySuppressedReason: replyAssessment.recommended ? undefined : replyAssessment.reason,
    suggestedTriageAction: replyAssessment.suggestedAction,
    replyContext: buildReplyEmailContext({
      sender: meta.sender,
      subject: meta.subject,
      body: meta.snippet,
      snippet: meta.snippet,
    }),
  };
}

export function resolveEmailDetailWorkflowMode(
  cookieValue: string | undefined,
  headerValue: string | null,
): WorkflowMode {
  if (headerValue) return parseWorkflowMode(headerValue);
  return parseWorkflowMode(cookieValue);
}
