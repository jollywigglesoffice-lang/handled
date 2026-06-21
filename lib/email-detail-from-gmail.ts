import type { EmailDetailPayload } from "@/app/emails/[id]/email-detail-view";
import { buildReplyEmailContext } from "@/lib/build-reply-email-context";
import {
  enrichEmailDetailIntelligence,
  toEnrichmentMeta,
} from "@/lib/email-detail-enrichment";
import { gmailGetMessageFull, gmailGetMessageMetadata } from "@/lib/gmail-api";
import { resolveEmailDisplayBody } from "@/lib/gmail-extract-body";

type GmailMessageFull = Awaited<ReturnType<typeof gmailGetMessageFull>>;
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";
import { assessReplyNeed } from "@/lib/reply-necessity";
import { heuristicEmailSummary } from "@/lib/email-summary";
import type { InboxSectionTitle } from "@/lib/fake-emails";
import { parseWorkflowMode, type WorkflowMode } from "@/lib/workflow-mode";

function legacySectionForCategory(category: InboxAiCategory): InboxSectionTitle {
  if (category === "worth_your_attention") {
    return "Needs Your Attention";
  }
  if (category === "promotions" || category === "newsletters") {
    return "Hidden Inbox";
  }
  return "Handled For You";
}

/** Guarantee subject, sender, and body or snippet for every email detail response. */
export function ensureMinimumEmailDetail(
  email: EmailDetailPayload,
): EmailDetailPayload {
  const sender = email.sender?.trim() || "Unknown sender";
  const subject = email.subject?.trim() || "(No subject)";
  const snippet = email.summary?.trim() ?? "";
  const { bodyText, bodyHtml } = resolveEmailDisplayBody({
    bodyPlain: email.bodyPlain ?? email.body ?? "",
    bodyHtml: email.bodyHtml ?? "",
    snippet,
  });

  return {
    ...email,
    sender,
    subject,
    body: bodyText,
    bodyPlain: bodyText,
    bodyHtml: bodyHtml || email.bodyHtml,
    summary: snippet || email.summary,
  };
}

export function emailDetailHasDisplayContent(email: EmailDetailPayload): boolean {
  const sender = email.sender?.trim();
  const subject = email.subject?.trim();
  const body = (email.bodyPlain ?? email.body ?? "").trim();
  const snippet = email.summary?.trim();
  return Boolean(sender && subject && (body || snippet));
}

export async function buildEmailDetailFromGmailMessage(
  msg: GmailMessageFull,
  userId: string,
  workflowMode: WorkflowMode,
  options?: { accountId?: string },
): Promise<EmailDetailPayload> {
  const bodyHtml = msg.bodyHtml?.trim() ?? "";
  const bodyPlain = msg.bodyText?.trim() ?? "";
  const { bodyText: displayPlain, bodyHtml: displayHtml } = resolveEmailDisplayBody({
    bodyPlain,
    bodyHtml,
    snippet: msg.snippet ?? "",
  });

  const meta = toEnrichmentMeta({
    id: msg.id,
    accountId: options?.accountId,
    threadId: msg.threadId,
    sender: msg.sender,
    subject: msg.subject,
    snippet: msg.snippet,
    internalDateMs: msg.internalDateMs,
  });

  const intel = await enrichEmailDetailIntelligence(meta, userId, workflowMode, {
    displayPlain,
    bodyHtml: displayHtml,
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

  return ensureMinimumEmailDetail({
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
    internalDateMs: msg.internalDateMs,
    needsCalendarContext: intel.calendarAwareness?.needsCalendarContext ?? false,
    schedulingIntentDetected:
      intel.calendarAwareness?.schedulingIntent?.detected ?? false,
    calendarIntentLevel: intel.calendarAwareness?.calendarIntentLevel ?? "NO_TIME_CONTEXT",
    actionIntelligence: intel.actionIntelligence,
    timelineIntelligence: intel.timelineIntelligence,
    proactiveAssistant: intel.proactiveAssistant,
    decisionAssistance: intel.decisionAssistance,
    enrichmentWarnings: intel.enrichmentWarnings,
    body: displayPlain,
    bodyPlain: displayPlain,
    bodyHtml: displayHtml || undefined,
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
  });
}

export async function buildEmailDetailFromGmailMetadata(
  accessToken: string,
  id: string,
  userId: string,
  workflowMode: WorkflowMode,
  options?: { accountId?: string },
): Promise<EmailDetailPayload> {
  const meta = await gmailGetMessageMetadata(accessToken, id);
  const enrichmentMeta = toEnrichmentMeta({ ...meta, accountId: options?.accountId });
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

  return ensureMinimumEmailDetail({
    id: meta.id,
    section: legacySectionForCategory(category),
    sender: meta.sender,
    subject: meta.subject,
    summary: meta.snippet,
    category: inboxCategorySectionTitle(category, "en"),
    inboxCategory: category,
    aiSummary,
    relationship: intel.relationship,
    internalDateMs: meta.internalDateMs,
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
  });
}

export function resolveEmailDetailWorkflowMode(
  cookieValue: string | undefined,
  headerValue: string | null,
): WorkflowMode {
  if (headerValue) return parseWorkflowMode(headerValue);
  return parseWorkflowMode(cookieValue);
}
