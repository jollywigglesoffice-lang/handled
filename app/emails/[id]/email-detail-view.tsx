"use client";

import { useState } from "react";
import Link from "next/link";
import { EmailActions } from "./email-actions";
import { EmailBody } from "./email-body";
import { EmailDetailInsights } from "./email-detail-insights";
import { RelationshipBadge } from "@/app/emails/relationship-badge";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import type { FakeEmail } from "@/lib/fake-emails";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";
import type { ActionIntelligenceResult } from "@/lib/action-intelligence";
import type { DecisionAssistanceResult } from "@/lib/decision-assistance";
import type { ProactiveAssistantResult } from "@/lib/proactive-assistant";
import type { TimelineIntelligenceResult } from "@/lib/timeline-intelligence";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { UnsubscribeAnalysis } from "@/lib/unsubscribe/types";

export type EmailDetailPayload = FakeEmail & {
  bodyPlain?: string;
  bodyHtml?: string;
  replyContext?: string;
  inboxCategory?: InboxAiCategory;
  replyRecommended?: boolean;
  replySuppressedReason?: string;
  suggestedTriageAction?: string;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
  unsubscribeAnalysis?: UnsubscribeAnalysis;
  unsubscribeReplyDraft?: string;
  followUpAnalysis?: FollowUpAnalysis;
  relationship?: SenderRelationshipProfile;
  needsCalendarContext?: boolean;
  schedulingIntentDetected?: boolean;
  actionIntelligence?: ActionIntelligenceResult;
  timelineIntelligence?: TimelineIntelligenceResult;
  proactiveAssistant?: ProactiveAssistantResult;
  decisionAssistance?: DecisionAssistanceResult;
  enrichmentWarnings?: string[];
};

type EmailDetailViewProps = {
  email: EmailDetailPayload;
  showActions?: boolean;
  enrichmentEnabled?: boolean;
};

function suggestedNextStep(
  email: EmailDetailPayload,
  locale: "en" | "it",
): string | null {
  const action = email.actionIntelligence;
  if (action?.suggestedNextAction?.trim()) {
    return action.suggestedNextAction.trim();
  }
  if (email.suggestedTriageAction?.trim()) {
    return email.suggestedTriageAction.trim();
  }
  if (action?.actionable && action.primaryLabel) {
    return action.primaryLabel.replace(/_/g, " ");
  }
  return null;
}

export function EmailDetailView({
  email,
  showActions = true,
  enrichmentEnabled = true,
}: EmailDetailViewProps) {
  const [replyDraftOverride, setReplyDraftOverride] = useState(
    email.unsubscribeReplyDraft ?? "",
  );
  const ui = useUiCopy();
  const { uiLanguage } = useUserPreferences();
  const categoryLocale = uiLocaleFromLanguage(uiLanguage) === "it" ? "it" : "en";
  const workflowMode = readWorkflowModeFromStorage();

  const summary =
    email.aiSummary?.trim() ||
    (categoryLocale === "it" ? "Nessun riepilogo disponibile." : "No summary available.");
  const nextStep = suggestedNextStep(email, categoryLocale);

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Link
          href="/emails"
          className="text-sm text-gray-400 transition-colors hover:text-gray-600"
        >
          {ui.common.backToInbox}
        </Link>

        <header className="mt-6 space-y-3">
          <p className="text-sm text-gray-500">{email.sender}</p>

          <h1 className="text-2xl font-semibold leading-snug tracking-tight text-gray-900 sm:text-[1.65rem]">
            {email.subject}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {email.inboxCategory ? (
              <span>{inboxCategorySectionTitle(email.inboxCategory, categoryLocale)}</span>
            ) : null}
            {email.relationship ? (
              <RelationshipBadge relationship={email.relationship} />
            ) : null}
          </div>

          <p className="text-[15px] leading-relaxed text-gray-600">{summary}</p>

          {nextStep ? (
            <p className="text-sm leading-relaxed text-gray-700">
              <span className="font-medium text-accent">
                {categoryLocale === "it" ? "Prossimo passo · " : "Suggested next step · "}
              </span>
              {nextStep}
            </p>
          ) : null}
        </header>

        <article className="mt-8">
          <h2 className="mb-3 text-xs font-medium text-gray-400">
            {ui.emailDetail.fullEmailBody}
          </h2>
          <EmailBody
            variant="minimal"
            bodyHtml={email.bodyHtml}
            bodyPlain={email.bodyPlain ?? email.body}
          />
        </article>

        {showActions ? (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-medium text-gray-400">
              {categoryLocale === "it" ? "Bozza di risposta" : "Draft reply"}
            </h2>
            <EmailActions
              calmLayout
              emailId={email.id}
              emailContent={email.replyContext ?? email.body}
              senderName={email.sender}
              subject={email.subject}
              snippet={email.summary}
              suggestedReply={replyDraftOverride || email.suggestedReply}
              inboxCategory={email.inboxCategory}
              replyRecommended={email.replyRecommended ?? true}
              replySuppressedReason={email.replySuppressedReason}
              suggestedTriageAction={email.suggestedTriageAction}
              followUpAnalysis={email.followUpAnalysis}
              relationship={email.relationship}
            />
          </section>
        ) : null}

        <EmailDetailInsights
          email={email}
          locale={categoryLocale}
          enrichmentEnabled={enrichmentEnabled}
          workflowMode={workflowMode}
          onUseReplyDraft={(text) => setReplyDraftOverride(text)}
        />
      </div>
    </main>
  );
}
