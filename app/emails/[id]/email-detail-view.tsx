"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompletionWorkflow } from "@/app/completion-workflow-context";
import { useInboxCategories } from "@/app/inbox-categories-context";
import { EmailStatusBar } from "@/app/components/email-status-bar";
import { PassiveAwarenessLine } from "@/app/components/passive-awareness-line";
import { IntentChips } from "@/app/components/intent-chips";
import { CategoryCorrectionPanel } from "@/app/emails/category-correction-panel";
import { EmailActions } from "./email-actions";
import { EmailBody } from "./email-body";
import { SmartReplyPanel } from "@/app/emails/smart-reply-panel";
import { EmailSchedulePanel } from "@/app/components/email-schedule-panel";
import { EmailSoftSchedulingHint } from "@/app/components/email-soft-scheduling-hint";
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
  collectEmailOpened,
  collectEmailViewedWithoutAction,
} from "@/lib/memory-engine/collect";
import {
  getIntelligenceVerbosity,
  recordEmailEngagement,
  showExplicitNextStepLabel,
} from "@/lib/intelligence-quiet";
import { buildExtractiveSummary, buildSituationBundle } from "@/lib/situational-understanding";
import {
  inboxReturnDestinationLabel,
  inboxReturnPath,
  loadInboxReturnContext,
  queueInboxScrollRestore,
} from "@/lib/inbox-return-context";
import { submitCategoryFeedback } from "@/lib/apply-category-feedback";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { gmailForwardComposeUrl } from "@/lib/gmail-forward-url";

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
  calendarIntentLevel?: import("@/lib/calendar-awareness/types").CalendarIntentLevel;
  accountId?: string;
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
  const [detailCategory, setDetailCategory] = useState<InboxAiCategory>(
    email.inboxCategory ?? "worth_your_attention",
  );
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
  const guessedCategoryRef = useRef(email.inboxCategory ?? "worth_your_attention");
  const userActedRef = useRef(false);
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
    void collectEmailOpened({
      emailId: email.id,
      accountId,
      sender: email.sender,
      subject: email.subject,
      aiCategory: guessedCategoryRef.current,
    });

    return () => {
      if (userActedRef.current) return;
      void collectEmailViewedWithoutAction({
        emailId: email.id,
        accountId,
        sender: email.sender,
        subject: email.subject,
        aiCategory: guessedCategoryRef.current,
      });
    };
  }, [email.id, email.sender, email.subject, accountId]);

  const verbosity = useMemo(() => getIntelligenceVerbosity(), [email.id]);

  const category = detailCategory;
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
    buildExtractiveSummary(
      { sender: email.sender, subject: email.subject, snippet: email.summary, bodyPlain: email.bodyPlain },
      category,
      { category, locale, relationship: email.relationship },
    );

  const displaySummary =
    summary &&
    !/needs attention|likely needs|scheduling request|trying to schedule|needs confirmation|needs you to|is asking|ai detected|handled suggests|no summary available/i.test(
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
    () =>
      mergeAmbientContextLines(
        situation.interpretation ? [situation.interpretation, ...continuity.lines] : continuity.lines,
        anticipatory.contextLines,
        2,
      ),
    [continuity.lines, anticipatory.contextLines, situation.interpretation],
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

  const shouldPrefetch = showActions;

  const forwardHref = useMemo(
    () =>
      gmailForwardComposeUrl({
        subject: email.subject,
        body: email.bodyPlain ?? email.body,
        sender: email.sender,
      }),
    [email.subject, email.bodyPlain, email.body, email.sender],
  );

  const handleCategoryApply = useCallback(
    async (chosen: InboxAiCategory, scope: CategoryApplyScope) => {
      userActedRef.current = true;
      setDetailCategory(chosen);
      setShowCategoryPanel(false);
      try {
        const result = await submitCategoryFeedback({
          emailId: email.id,
          sender: email.sender,
          subject: email.subject,
          snippet: email.summary,
          guessedCategory: guessedCategoryRef.current,
          chosenCategory: chosen,
          scope,
          accountId,
        });
        guessedCategoryRef.current = chosen;
        setCategoryFeedback(result.message);
        if (scope === "this_email") {
          window.dispatchEvent(new Event("handled-email-overrides-changed"));
        } else {
          window.dispatchEvent(new Event("handled-inbox-rules-changed"));
          window.dispatchEvent(new Event("handled-sender-preferences-changed"));
          window.dispatchEvent(new Event("handled-inbox-refresh-requested"));
        }
      } catch (error) {
        setCategoryFeedback(
          error instanceof Error ? error.message : "Could not save category.",
        );
      }
      window.setTimeout(() => setCategoryFeedback(null), 4000);
    },
    [email.id, email.sender, email.subject, email.summary, accountId],
  );

  const backHref = inboxReturnPath(returnContext);
  const backLabel = useMemo(() => {
    if (!returnContext) return ui.common.backToInbox;
    const dest = inboxReturnDestinationLabel(returnContext, category, locale, catalog);
    return locale === "it" ? `Torna a ${dest}` : `Back to ${dest}`;
  }, [returnContext, category, locale, catalog, ui.common.backToInbox]);

  const handleCompleted = useCallback(
    ({ actionId, actionLabel }: { actionId: CompletionActionId; actionLabel: string }) => {
      userActedRef.current = true;
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
            actionable={email.actionIntelligence?.actionable}
            actionState={email.actionIntelligence?.actionState}
            forwardHref={forwardHref}
            onOpenChangeCategory={() => setShowCategoryPanel((v) => !v)}
            onCompleted={handleCompleted}
          />

          {email.actionIntelligence?.actionState === "passive" ? (
            <PassiveAwarenessLine locale={locale} />
          ) : null}

          {showCategoryPanel ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <CategoryCorrectionPanel
                compact
                target={{
                  id: email.id,
                  sender: email.sender,
                  subject: email.subject,
                  snippet: email.summary,
                  guessedCategory: guessedCategoryRef.current,
                }}
                onApply={(chosen, scope) => void handleCategoryApply(chosen, scope)}
                onDismiss={() => setShowCategoryPanel(false)}
              />
            </div>
          ) : null}

          {categoryFeedback ? (
            <p className="text-xs font-medium text-emerald-700">{categoryFeedback}</p>
          ) : null}

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
          <section className="mt-6 space-y-6">
            {email.calendarIntentLevel === "SCHEDULE_REQUIRED" ? (
              <EmailSchedulePanel
                embedded
                emailId={email.id}
                sender={email.sender}
                subject={email.subject}
                locale={locale}
                accountId={accountId ?? email.accountId}
                onDraftReply={(text) => setReplyDraftOverride(text)}
              />
            ) : email.calendarIntentLevel === "SOFT_SCHEDULING" ? (
              <EmailSoftSchedulingHint locale={locale} />
            ) : null}
            <SmartReplyPanel
              emailId={email.id}
              accountId={accountId ?? email.accountId}
              sender={email.sender}
              subject={email.subject}
              snippet={email.summary}
              emailContent={email.replyContext ?? email.bodyPlain ?? email.body}
              category={category}
              locale={locale}
              forceOffer
              embedded
              initialDraft={replyDraftOverride || undefined}
              onDismiss={() => {}}
            />
            <div>
            <h2 className="mb-3 text-xs font-medium text-gray-400">
              {locale === "it" ? "Compositore avanzato" : "Advanced composer"}
            </h2>
            <EmailActions
              calmLayout
              alwaysOfferReply
              anticipatoryPrefetch
              emailId={email.id}
              emailContent={email.replyContext ?? email.body}
              senderName={email.sender}
              subject={email.subject}
              snippet={email.summary}
              suggestedReply={replyDraftOverride || email.suggestedReply}
              inboxCategory={category}
              replyRecommended={email.replyRecommended ?? true}
              replySuppressedReason={email.replySuppressedReason}
              suggestedTriageAction={email.suggestedTriageAction}
              followUpAnalysis={email.followUpAnalysis}
              relationship={email.relationship}
            />
            </div>
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
