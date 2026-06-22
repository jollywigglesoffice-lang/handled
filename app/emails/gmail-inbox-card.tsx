"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InboxCalmActions } from "@/app/components/inbox-calm-actions";
import { SmartReplyPanel } from "@/app/emails/smart-reply-panel";
import { InboxCardDetails } from "@/app/components/inbox-card-details";
import { InboxEmotionalStateIndicator } from "@/app/components/inbox-emotional-state";
import { InboxSchedulePanel } from "@/app/components/inbox-schedule-panel";
import { PassiveAwarenessLine } from "@/app/components/passive-awareness-line";
import {
  AutopilotAttentionBadge,
  AutopilotSuggestionLine,
} from "@/app/components/autopilot-status";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import { useEmailStatusActions } from "@/app/emails/use-email-status-actions";
import { useInboxCategories } from "@/app/inbox-categories-context";
import { CategoryCorrectionPanel } from "@/app/emails/category-correction-panel";
import { useCategoryFeedback } from "@/app/hooks/use-category-feedback";
import { logSenderRuleDebug, senderIdentityForTeachHandled } from "@/lib/sender-identity";
import {
  clearSenderLearningSuggestion,
  getSenderLearningSuggestion,
} from "@/lib/sender-correction-learning";
import { assignSenderRelationshipPreset } from "@/lib/relationship-intelligence/client-sync";
import type { CategoryApplyScope } from "@/lib/category-correction";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import { RelationshipAssignPanel } from "@/app/emails/relationship-assign-panel";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { ActionIntelligenceSummary } from "@/lib/action-intelligence";
import type { TimeImpactResult } from "@/lib/time-impact/types";
import { logAssistedConfirmation } from "@/lib/autopilot/execute";
import type { AutopilotSummary } from "@/lib/autopilot/types";
import type { ConversationStatus } from "@/lib/timeline-intelligence";
import { shouldShowUnsubscribeInboxBadge } from "@/lib/workflow-mode-unsubscribe";
import { useUiCopy } from "@/app/use-ui-copy";
import { saveEmailPreview } from "@/lib/email-preview-cache";
import {
  captureInboxReturnFromOpen,
  type InboxReturnCapture,
} from "@/lib/inbox-return-context";
import { buildContinuityContext } from "@/lib/continuity-context";
import { buildInboxGlanceLine } from "@/lib/glance-clarity";
import { buildSituationBundle } from "@/lib/situational-understanding";
import {
  buildInboxMetaDetails,
  resolveInboxEmotionalState,
  resolveInboxPrimaryAction,
} from "@/lib/inbox-emotional-state";
import { trackEvent } from "@/lib/analytics";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategorySource } from "@/lib/inbox-ai-categories";
import { inboxCategoryTitle } from "@/lib/inbox-category-catalog";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import { HandledDebugBadge } from "@/app/emails/handled-debug-badge";
import type { CategoryResolutionAudit } from "@/lib/final-category-resolution";
import type { CalendarIntentLevel } from "@/lib/calendar-awareness/types";

export type GmailCardMessage = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  category: InboxAiCategory;
  categoryConfidence?: number;
  categorySource?: CategorySource;
  hasUnsubscribeSignal?: boolean;
  needsCalendarContext?: boolean;
  calendarIntentLevel?: CalendarIntentLevel;
  actionIntelligence?: ActionIntelligenceSummary;
  timeImpact?: TimeImpactResult;
  autopilot?: AutopilotSummary;
  timelineIntelligence?: {
    active: boolean;
    conversationStatus: ConversationStatus;
    timelineSummary: string;
    escalationScore: number;
  };
  relationship?: SenderRelationshipProfile;
  waitingResponseUpdate?: boolean;
  /** Post-action workflow — not an inbox category. */
  workflowState?: "waiting_on";
  waitingOnPerson?: string;
  accountId?: string;
  accountEmail?: string;
  accountLabel?: string;
  categoryResolution?: CategoryResolutionAudit;
};

function emailDetailHref(message: GmailCardMessage): string {
  const base = `/emails/${encodeURIComponent(message.id)}`;
  if (message.accountId) {
    return `${base}?accountId=${encodeURIComponent(message.accountId)}`;
  }
  return base;
}

function formatInboxDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type GmailInboxCardProps = {
  message: GmailCardMessage;
  locale: "en" | "it";
  onCategoryChange: (
    id: string,
    category: InboxAiCategory,
    options?: InboxCategoryChangeOptions,
  ) => void;
  onResetOverride?: (id: string) => void | Promise<void>;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (id: string) => void;
  readStateMap?: ReadStateMap;
  inboxReturnCapture?: InboxReturnCapture;
  showAccountBadge?: boolean;
  /** Calm mode — fewer actions, less noise. */
  calmMode?: boolean;
};

export function GmailInboxCard({
  message,
  locale,
  onCategoryChange,
  onResetOverride,
  selected = false,
  selectionMode = false,
  onToggleSelect,
  readStateMap = {},
  inboxReturnCapture,
  showAccountBadge = false,
  calmMode = false,
}: GmailInboxCardProps) {
  const [feedback, setFeedback] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatusState>("idle");
  const [showCorrection, setShowCorrection] = useState(false);
  const [showRelationship, setShowRelationship] = useState(false);
  const [showSmartReply, setShowSmartReply] = useState(false);
  const [learningPrompt, setLearningPrompt] = useState<string | null>(null);
  const initialLearning = useMemo(
    () => getSenderLearningSuggestion(message.sender, locale)?.message ?? null,
    [message.sender, locale],
  );
  const ui = useUiCopy();
  const { catalog } = useInboxCategories();
  const { submitCategoryFeedback } = useCategoryFeedback();

  const emailStatus = useEmailStatusActions({
    emailId: message.id,
    accountId: message.accountId,
    accountEmail: message.accountEmail,
    accountLabel: message.accountLabel,
    threadId: message.threadId,
    sender: message.sender,
    subject: message.subject,
    snippet: message.snippet,
    category: message.category,
    locale,
    readStateMap,
    onCompleted: ({ actionId, actionLabel }) => {
      logAssistedConfirmation(
        {
          id: message.id,
          accountId: message.accountId,
          sender: message.sender,
          subject: message.subject,
          snippet: message.snippet,
          category: message.category,
          autopilot: message.autopilot,
        },
        actionId,
        actionLabel,
        locale,
      );
    },
  });

  const isUnread = emailStatus.lifecycle === "unread";
  const guessedRef = useRef(message.category);
  useEffect(() => {
    guessedRef.current = message.category;
  }, [message.id, message.category]);

  const catLabel = inboxCategoryTitle(message.category, locale, catalog);
  const learnedApplied = message.categorySource === "sender_rule";
  const manualOverride = message.categorySource === "manual_override";
  const workflowMode = readWorkflowModeFromStorage();
  const showNewsletterBadge =
    shouldShowUnsubscribeInboxBadge(
      workflowMode,
      Boolean(message.hasUnsubscribeSignal),
      message.category,
    ) ||
    (workflowMode === "assist" &&
      (message.category === "newsletters" || message.category === "promotions"));
  const newsletterLabel =
    message.category === "promotions"
      ? locale === "it"
        ? "Promozione"
        : "Promotion"
      : locale === "it"
        ? "Newsletter"
        : "Newsletter";

  const emotionalInput = {
    category: message.category,
    actionIntelligence: message.actionIntelligence,
    calendarIntentLevel: message.calendarIntentLevel,
    waitingResponseUpdate: message.waitingResponseUpdate,
    timelineStatus: message.timelineIntelligence?.conversationStatus,
    timeImpactKind: message.timeImpact?.kind,
  };
  const emotionalState = resolveInboxEmotionalState(emotionalInput);
  const primaryAction = resolveInboxPrimaryAction(emotionalInput);
  const isPassive = message.actionIntelligence?.actionState === "passive";
  const showSchedulePanel =
    message.calendarIntentLevel === "SCHEDULE_REQUIRED" && !emailStatus.completed;
  const [scheduleDraft, setScheduleDraft] = useState<string | null>(null);

  const metaLine = buildInboxMetaDetails({
    locale,
    categoryLabel: catLabel,
    showNewsletterBadge,
    newsletterLabel,
    learnedApplied,
    manualOverride,
    needsCalendarContext: message.needsCalendarContext,
    relationship: message.relationship,
    accountLabel: message.accountLabel,
    showAccountBadge,
    waitingResponseUpdate: message.waitingResponseUpdate,
    timelineStatus: message.timelineIntelligence?.conversationStatus,
    primaryLabel: message.actionIntelligence?.primaryLabel,
  });

  const handleApply = useCallback(
    async (chosen: InboxAiCategory, scope: CategoryApplyScope) => {
      const options: InboxCategoryChangeOptions = {
        scope,
        guessedCategory: guessedRef.current,
        ...(scope === "sender" ? { sender: message.sender } : {}),
      };

      logSenderRuleDebug("category menu apply (click handler)", {
        ...senderIdentityForTeachHandled({
          emailId: message.id,
          sender: message.sender,
          subject: message.subject,
          scope,
          category: chosen,
        }),
        guessedCategory: guessedRef.current,
        categorySource: message.categorySource,
      });

      onCategoryChange(message.id, chosen, options);
      setSaveStatus("saving");

      try {
        const result = await submitCategoryFeedback({
          emailId: message.id,
          sender: message.sender,
          subject: message.subject,
          snippet: message.snippet,
          guessedCategory: guessedRef.current,
          chosenCategory: chosen,
          scope,
          accountId: message.accountId,
        });
        const extra =
          scope === "sender" ? " Matching emails in your inbox were updated." : "";
        setFeedback(`${result.message}${extra}`);
        if (result.senderLearningSuggestion) {
          setLearningPrompt(result.senderLearningSuggestion);
        }
        setSaveStatus(scope === "sender" ? "synced" : "saved");
        guessedRef.current = chosen;
        if (scope === "this_email") {
          window.dispatchEvent(new Event("handled-email-overrides-changed"));
        }
        if (scope !== "this_email") {
          window.dispatchEvent(new Event("handled-inbox-rules-changed"));
          window.dispatchEvent(new Event("handled-sender-preferences-changed"));
          window.dispatchEvent(new Event("handled-inbox-refresh-requested"));
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Could not save";
        setFeedback(errMsg || "Could not save — try again.");
        setSaveStatus(scope === "this_email" ? "offline" : "error");
      }
      window.setTimeout(() => setSaveStatus("idle"), 2500);
      setShowCorrection(false);
    },
    [message, onCategoryChange],
  );

  const handleReset = useCallback(async () => {
    if (!onResetOverride) return;
    setSaveStatus("saving");
    try {
      await onResetOverride(message.id);
      setFeedback("Override removed — AI categorization restored.");
      setSaveStatus("synced");
      window.dispatchEvent(new Event("handled-email-overrides-changed"));
    } catch {
      setFeedback("Handled couldn't reset — try again.");
      setSaveStatus("error");
    }
    window.setTimeout(() => setSaveStatus("idle"), 2500);
  }, [message.id, onResetOverride]);

  const activeLearningPrompt = learningPrompt ?? initialLearning;

  const acceptLearningPrioritize = useCallback(async () => {
    setSaveStatus("saving");
    try {
      await assignSenderRelationshipPreset(message.sender, "school");
      await handleApply("worth_your_attention", "sender");
      clearSenderLearningSuggestion(message.sender);
      setLearningPrompt(null);
    } catch {
      setFeedback("Handled couldn't save — try again.");
      setSaveStatus("error");
    }
  }, [message.sender, handleApply]);

  const selectLabel =
    locale === "it"
      ? `Seleziona email da ${message.sender}`
      : `Select email from ${message.sender}`;

  const panelsOpen = showCorrection || showRelationship || emailStatus.showDonePicker || showSmartReply;

  const captureReturn = useCallback(() => {
    if (!inboxReturnCapture) return;
    captureInboxReturnFromOpen(inboxReturnCapture, message.id);
  }, [inboxReturnCapture, message.id]);

  const preview = buildInboxMessagePreview(message, locale);
  const detailHref = emailDetailHref(message);

  return (
    <div
      className={`group relative -mx-2 flex items-start gap-3 rounded-lg px-2 py-4 transition-colors duration-200 hover:bg-gray-50/60 ${
        selected ? "bg-gray-50/80" : ""
      }`}
    >
      {onToggleSelect ? (
        <div
          className={`flex shrink-0 items-center self-stretch pt-0.5 transition-opacity duration-150 ${
            selected || selectionMode
              ? "opacity-100"
              : "opacity-0 focus-within:opacity-100 group-hover:opacity-100"
          }`}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(message.id)}
            aria-label={selectLabel}
            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#9733ff] accent-[#9733ff] focus:ring-2 focus:ring-[#9733ff] focus:ring-offset-1"
          />
        </div>
      ) : null}

      <article className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-3">
          {message.autopilot?.state === "worth_your_attention" ? (
            <AutopilotAttentionBadge autopilot={message.autopilot} locale={locale} />
          ) : (
            <InboxEmotionalStateIndicator state={emotionalState} locale={locale} />
          )}
          <time className="shrink-0 text-[11px] text-gray-300" dateTime={message.date}>
            {formatInboxDate(message.date)}
          </time>
        </div>

        <p
          className={`text-sm leading-snug ${
            isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-500"
          }`}
        >
          {message.sender}
        </p>

        <Link
          href={detailHref}
          className="block rounded outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onClick={() => {
            captureReturn();
            if (message.waitingResponseUpdate) {
              trackEvent("response_received_opened", {
                response_email_id: message.id,
                thread_id: message.threadId ?? null,
                source: "inbox",
              });
            }
            saveEmailPreview({
              id: message.id,
              sender: message.sender,
              subject: message.subject,
              snippet: message.snippet,
              summary: preview.glanceLine,
              chips: [],
            });
          }}
        >
          <h3
            className={`text-[15px] leading-snug text-gray-900 transition-colors duration-200 hover:text-gray-700 ${
              isUnread ? "font-semibold" : "font-medium"
            }`}
          >
            {isUnread ? (
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-sky-500 align-middle"
                aria-hidden
              />
            ) : null}
            {message.subject}
          </h3>
        </Link>

        {!calmMode && message.autopilot?.state === "assisted" ? (
          <AutopilotSuggestionLine autopilot={message.autopilot} locale={locale} />
        ) : null}

        {!calmMode && isPassive && !emailStatus.completed ? (
          <PassiveAwarenessLine locale={locale} />
        ) : (
          <p className="text-sm leading-relaxed text-gray-500 calm-fade-in">
            {message.timeImpact?.deadlineHint && !calmMode
              ? `${preview.glanceLine} · ${message.timeImpact.deadlineHint}`
              : preview.glanceLine}
          </p>
        )}

        {showSchedulePanel ? (
          <div id={`schedule-panel-${message.id}`}>
          <InboxSchedulePanel
            emailId={message.id}
            sender={message.sender}
            subject={message.subject}
            locale={locale}
            accountId={message.accountId}
            detailHref={detailHref}
            onDraftReply={(text) => {
              setScheduleDraft(text);
              setShowSmartReply(true);
            }}
            onScheduled={(msg) => setFeedback(msg)}
          />
          </div>
        ) : null}

        {showRelationship ? (
          <RelationshipAssignPanel
            compact
            sender={message.sender}
            onDismiss={() => setShowRelationship(false)}
          />
        ) : null}

        {activeLearningPrompt && !panelsOpen && !calmMode ? (
          <div className="rounded-lg bg-amber-50/60 px-3 py-2.5">
            <p className="text-xs leading-relaxed text-amber-900/80">{activeLearningPrompt}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void acceptLearningPrioritize()}
                className="rounded-md bg-amber-800/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-900"
              >
                {locale === "it" ? "Sì, prioritarizza" : "Yes, prioritize"}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSenderLearningSuggestion(message.sender);
                  setLearningPrompt(null);
                }}
                className="text-xs font-medium text-amber-800/70 hover:text-amber-900"
              >
                {locale === "it" ? "Non ora" : "Not now"}
              </button>
            </div>
          </div>
        ) : null}

        {showCorrection ? (
          <CategoryCorrectionPanel
            compact
            target={{
              id: message.id,
              sender: message.sender,
              subject: message.subject,
              snippet: message.snippet,
              guessedCategory: message.category,
            }}
            onApply={handleApply}
            onDismiss={() => setShowCorrection(false)}
          />
        ) : null}

        <InboxCalmActions
          status={emailStatus}
          locale={locale}
          primaryAction={primaryAction}
          detailHref={detailHref}
          calmMode={calmMode}
          hideActions={showCorrection || showRelationship}
          category={message.category}
          categoryConfidence={message.categoryConfidence}
          actionable={message.actionIntelligence?.actionable}
          actionState={message.actionIntelligence?.actionState}
          onChangeCategory={() => setShowCorrection(true)}
          onSetRelationship={() => setShowRelationship(true)}
          setRelationshipLabel={ui.relationship.assignLink}
          onResetOverride={() => void handleReset()}
          showResetOverride={manualOverride && Boolean(onResetOverride) && !panelsOpen}
          onSmartReply={
            primaryAction === "reply"
              ? () => setShowSmartReply(true)
              : undefined
          }
          onSchedule={
            primaryAction === "schedule" || showSchedulePanel
              ? () => {
                  document
                    .getElementById(`schedule-panel-${message.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
              : undefined
          }
        />

        {showSmartReply ? (
          <SmartReplyPanel
            emailId={message.id}
            accountId={message.accountId}
            sender={message.sender}
            subject={message.subject}
            snippet={message.snippet}
            emailContent={`${message.subject}\n\n${message.snippet}`}
            category={message.category}
            locale={locale}
            detailHref={detailHref}
            forceOffer={primaryAction === "reply"}
            initialDraft={scheduleDraft ?? undefined}
            onDismiss={() => setShowSmartReply(false)}
            onMarkReplied={() => {
              const label = locale === "it" ? "Risposto" : "Replied";
              void emailStatus.handleComplete("replied", label);
              setShowSmartReply(false);
            }}
          />
        ) : primaryAction === "ignore" && !emailStatus.completed ? (
          <p className="mt-3 text-xs text-gray-400">
            {locale === "it" ? "Nessuna azione necessaria" : "No action needed"}
          </p>
        ) : null}

        <InboxCardDetails locale={locale} metaLine={metaLine} />

        <HandledDebugBadge
          categoryResolution={message.categoryResolution}
          autopilot={message.autopilot}
          categorySource={message.categorySource}
        />

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <SaveStatus status={saveStatus} />
          {feedback ? <p className="text-xs text-emerald-700/80">{feedback}</p> : null}
        </div>
      </article>
    </div>
  );
}

function buildInboxMessagePreview(message: GmailCardMessage, locale: "en" | "it") {
  const row = {
    sender: message.sender,
    subject: message.subject,
    snippet: message.snippet,
  };
  const bundle = buildSituationBundle(row, {
    category: message.category,
    locale,
    relationship: message.relationship,
  });
  const haystack = `${message.sender} ${message.subject} ${message.snippet}`;
  let continuityLine: string | null = bundle.interpretation;
  if (
    message.timelineIntelligence?.active &&
    (message.timelineIntelligence.conversationStatus === "stalled" ||
      message.timelineIntelligence.conversationStatus === "waiting" ||
      message.timelineIntelligence.conversationStatus === "escalating")
  ) {
    continuityLine =
      buildContinuityContext({
        sender: message.sender,
        subject: message.subject,
        snippet: message.snippet,
        relationship: message.relationship,
        locale,
      }).lines[0] ?? continuityLine;
  }
  const glanceLine = buildInboxGlanceLine(bundle.summary, {
    continuityLine,
    nextStep:
      message.actionIntelligence?.actionState === "passive"
        ? null
        : (message.actionIntelligence?.suggestedNextAction ?? null),
    haystack,
    locale,
  });
  return { summary: bundle.summary, glanceLine };
}
