"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IntentChips } from "@/app/components/intent-chips";
import { EmailActions } from "./email-actions";
import { EmailBody } from "./email-body";
import { EmailDetailInsights } from "./email-detail-insights";
import { RelationshipBadge } from "@/app/emails/relationship-badge";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import type { FakeEmail } from "@/lib/fake-emails";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
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
import { ContinuityLines } from "@/app/components/continuity-lines";
import { continuityFromEmailDetail } from "@/lib/continuity-context";
import { buildSituationBundle, buildSituationSummary } from "@/lib/situational-understanding";

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
  const locale = uiLocaleFromLanguage(uiLanguage) === "it" ? "it" : "en";
  const workflowMode = readWorkflowModeFromStorage();

  const category = email.inboxCategory ?? "needs_attention";

  const situation = useMemo(() => {
    const row = {
      sender: email.sender,
      subject: email.subject,
      snippet: email.summary,
    };
    const rawNext =
      email.actionIntelligence?.suggestedNextAction?.trim() ||
      email.suggestedTriageAction?.trim() ||
      null;

    return buildSituationBundle(row, {
      category,
      locale,
      relationship: email.relationship,
      replyRecommended: email.replyRecommended ?? true,
      suggestedNextAction: rawNext,
      schedulingDetected: email.schedulingIntentDetected ?? email.needsCalendarContext,
    });
  }, [email, category, locale]);

  const summary =
    email.aiSummary?.trim() ||
    buildSituationSummary(
      { sender: email.sender, subject: email.subject, snippet: email.summary },
      category,
      { category, locale, relationship: email.relationship },
    );

  const displaySummary =
    summary &&
    !/needs attention|likely needs|scheduling request detected|no summary available/i.test(
      summary,
    )
      ? summary
      : situation.summary;

  const nextStep = situation.nextStep;

  const continuity = useMemo(
    () =>
      continuityFromEmailDetail(
        {
          sender: email.sender,
          subject: email.subject,
          summary: email.summary,
          bodyPlain: email.bodyPlain,
          relationship: email.relationship,
          followUpAnalysis: email.followUpAnalysis,
          timelineIntelligence: email.timelineIntelligence,
        },
        locale,
      ),
    [email, locale],
  );

  return (
    <main className="min-h-screen bg-[#fafafa] calm-fade-in">
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

          {email.relationship ? (
            <RelationshipBadge relationship={email.relationship} />
          ) : null}

          <p className="text-[15px] leading-relaxed text-gray-700">{displaySummary}</p>

          <IntentChips chips={situation.chips} />

          <ContinuityLines lines={continuity.lines} />

          {nextStep ? (
            <p className="text-sm leading-relaxed text-gray-600">
              <span className="font-medium text-gray-800">
                {locale === "it" ? "Prossimo passo · " : "Next step · "}
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
              {locale === "it" ? "Bozza di risposta" : "Draft reply"}
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
          locale={locale}
          enrichmentEnabled={enrichmentEnabled}
          workflowMode={workflowMode}
          onUseReplyDraft={(text) => setReplyDraftOverride(text)}
        />
      </div>
    </main>
  );
}
