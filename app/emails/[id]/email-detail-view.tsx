"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompletionWorkflow } from "@/app/completion-workflow-context";
import { useInboxCategories } from "@/app/inbox-categories-context";
import { EmailStatusBar } from "@/app/components/email-status-bar";
import { IntentChips } from "@/app/components/intent-chips";
import { EmailActions } from "./email-actions";
import { EmailBody } from "./email-body";
import { EmailDetailInsights } from "./email-detail-insights";
import { RelationshipBadge } from "@/app/emails/relationship-badge";
import { SenderRelationshipMemoryCard } from "@/app/emails/sender-relationship-memory";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import type { FakeEmail } from "@/lib/fake-emails";
import type { CompletionActionId } from "@/lib/completion-actions/types";
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
import { useAnticipatoryPrefetch } from "@/app/emails/[id]/use-anticipatory-prefetch";
import {
  buildAnticipatoryBundle,
  mergeAmbientContextLines,
} from "@/lib/anticipatory-assistance";
import { continuityFromEmailDetail } from "@/lib/continuity-context";
import { loadClientHandledBrain } from "@/lib/handled-brain/client-storage";
import { retrieveBrainUsageDto } from "@/lib/knowledge/retrieve";
import { buildGlancePresentation } from "@/lib/glance-clarity";
import { recordSenderEmailOpen } from "@/lib/importance-memory";
import {
  getIntelligenceVerbosity,
  recordEmailEngagement,
  showExplicitNextStepLabel,
} from "@/lib/intelligence-quiet";
import { buildSituationBundle, buildSituationSummary } from "@/lib/situational-understanding";
import {
  inboxReturnDestinationLabel,
  inboxReturnPath,
  loadInboxReturnContext,
  queueInboxScrollRestore,
} from "@/lib/inbox-return-context";

const DETAIL_RETURN_DELAY_MS = 650;

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
  internalDateMs?: number;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  // Owning Gmail account — keeps completion/read state account-scoped.
  const accountId = searchParams.get("accountId") ?? undefined;
  const { notifyCompleted } = useCompletionWorkflow();
  const { catalog } = useInboxCategories();
  const { uiLanguage } = useUserPreferences();
  const locale = uiLocaleFromLanguage(uiLanguage) === "it" ? "it" : "en";
  const workflowMode = readWorkflowModeFromStorage();
  const returnContext = useMemo(() => loadInboxReturnContext(), []);

  useEffect(() => {
    recordEmailEngagement();
    recordSenderEmailOpen(email.sender);
  }, [email.id, email.sender]);

  const verbosity = useMemo(() => getIntelligenceVerbosity(), [email.id]);

  const category = email.inboxCategory ?? "needs_attention";
  const haystack = `${email.sender} ${email.subject} ${email.summary} ${email.bodyPlain ?? ""}`;

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
    !/needs attention|likely needs|scheduling request detected|ai detected|handled suggests|no summary available/i.test(
      summary,
    )
      ? summary
      : situation.summary;

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

  const anticipatory = useMemo(() => {
    const brain = loadClientHandledBrain();
    const brainUsage = retrieveBrainUsageDto(
      {
        emailText: `${email.summary}\n${email.bodyPlain ?? email.body ?? ""}`,
        subject: email.subject,
      },
      brain,
    );
    return buildAnticipatoryBundle({
      sender: email.sender,
      subject: email.subject,
      snippet: email.summary,
      bodyPlain: email.bodyPlain,
      category,
      relationship: email.relationship,
      replyRecommended: email.replyRecommended,
      schedulingDetected: email.schedulingIntentDetected ?? email.needsCalendarContext,
      suggestedNextAction:
        email.actionIntelligence?.suggestedNextAction ?? email.suggestedTriageAction,
      followUpAnalysis: email.followUpAnalysis,
      timelineIntelligence: email.timelineIntelligence,
      proactiveAssistant: email.proactiveAssistant,
      brainUsage,
      locale,
    });
  }, [email, category, locale]);

  const ambientLines = useMemo(
    () => mergeAmbientContextLines(continuity.lines, anticipatory.contextLines, 1),
    [continuity.lines, anticipatory.contextLines],
  );

  const rawNextStep = anticipatory.likelyNextStep ?? situation.nextStep;

  const glance = useMemo(
    () =>
      buildGlancePresentation({
        summary: displaySummary,
        nextStep: rawNextStep,
        ambientLines,
        chips: situation.chips,
        haystack,
        locale,
        verbosity,
      }),
    [
      displaySummary,
      rawNextStep,
      ambientLines,
      situation.chips,
      haystack,
      locale,
      verbosity,
    ],
  );

  const shouldPrefetch =
    showActions && (email.replyRecommended ?? true) && category !== "handled";

  const backHref = inboxReturnPath(returnContext);
  const backLabel = useMemo(() => {
    if (!returnContext) return ui.common.backToInbox;
    const dest = inboxReturnDestinationLabel(returnContext, category, locale, catalog);
    return locale === "it" ? `Torna a ${dest}` : `Back to ${dest}`;
  }, [returnContext, category, locale, catalog, ui.common.backToInbox]);

  const handleCompleted = useCallback(
    ({ actionId, actionLabel }: { actionId: CompletionActionId; actionLabel: string }) => {
      const returningTo = inboxReturnDestinationLabel(returnContext, category, locale, catalog);
      notifyCompleted({
        emailIds: [email.id],
        actionId,
        actionLabel,
        locale,
        returningTo,
      });

      const restoreCtx = returnContext ?? {
        view: "inbox" as const,
        categoryTab: "all",
        scrollY: 0,
        anchorEmailId: email.id,
      };
      queueInboxScrollRestore(restoreCtx);

      window.setTimeout(() => {
        router.push(inboxReturnPath(returnContext));
      }, DETAIL_RETURN_DELAY_MS);
    },
    [returnContext, category, locale, catalog, notifyCompleted, email.id, router],
  );

  useAnticipatoryPrefetch({
    emailId: email.id,
    enabled: shouldPrefetch,
  });

  return (
    <main className="min-h-screen bg-[#fafafa] calm-fade-in">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Link
          href={backHref}
          className="text-sm text-gray-400 transition-colors hover:text-gray-600"
        >
          {backLabel}
        </Link>

        <header className="mt-5 space-y-3">
          <EmailStatusBar
            emailId={email.id}
            accountId={accountId}
            sender={email.sender}
            subject={email.subject}
            snippet={email.summary}
            category={category}
            locale={locale}
            variant="detail"
            onCompleted={handleCompleted}
          />

          <p className="text-sm text-gray-500">{email.sender}</p>

          <h1 className="text-2xl font-semibold leading-snug tracking-tight text-gray-900 sm:text-[1.65rem]">
            {email.subject}
          </h1>

          {email.relationship ? (
            <RelationshipBadge relationship={email.relationship} />
          ) : null}

          <SenderRelationshipMemoryCard
            sender={email.sender}
            relationship={email.relationship}
            locale={locale}
            currentEmailMs={email.internalDateMs}
          />

          <p className="text-[15px] leading-snug text-gray-800">{glance.primary}</p>

          {glance.secondary ? (
            <p className="text-xs leading-relaxed text-gray-500">{glance.secondary}</p>
          ) : null}

          <IntentChips chips={glance.chips} />

          {glance.nextStep && showExplicitNextStepLabel(verbosity) ? (
            <p className="text-sm leading-snug text-gray-600">{glance.nextStep}</p>
          ) : null}
        </header>

        <article className="mt-6">
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
          <section className="mt-6">
            <h2 className="mb-3 text-xs font-medium text-gray-400">
              {locale === "it" ? "Bozza di risposta" : "Draft reply"}
            </h2>
            <EmailActions
              calmLayout
              anticipatoryPrefetch
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
          verbosity={verbosity}
          onUseReplyDraft={(text) => setReplyDraftOverride(text)}
        />
      </div>
    </main>
  );
}
