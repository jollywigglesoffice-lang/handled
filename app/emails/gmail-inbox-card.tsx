"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import {
  type InboxAiCategory,
  inboxCategorySectionTitle,
} from "@/lib/inbox-ai-categories";
import type { CategorySource } from "@/lib/inbox-ai-categories";
import { CategoryCorrectionPanel } from "@/app/emails/category-correction-panel";
import { submitCategoryFeedback } from "@/lib/apply-category-feedback";
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
import { RelationshipBadge } from "@/app/emails/relationship-badge";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import { CalendarContextBadge } from "@/app/components/calendar-context-badge";
import type { ActionLabelId } from "@/lib/action-intelligence";
import { ConversationStatusChip } from "@/app/components/conversation-status-chip";
import type { ConversationStatus } from "@/lib/timeline-intelligence";
import { shouldShowUnsubscribeInboxBadge } from "@/lib/workflow-mode-unsubscribe";
import { useUiCopy } from "@/app/use-ui-copy";
import { saveEmailPreview } from "@/lib/email-preview-cache";
import { buildContinuityContext } from "@/lib/continuity-context";
import { buildInboxGlanceLine } from "@/lib/glance-clarity";
import { buildSituationSummary } from "@/lib/situational-understanding";

export type GmailCardMessage = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  category: InboxAiCategory;
  categoryConfidence?: number;
  categorySource?: CategorySource;
  hasUnsubscribeSignal?: boolean;
  needsCalendarContext?: boolean;
  actionIntelligence?: {
    actionable: boolean;
    primaryLabel: ActionLabelId | null;
    suggestedNextAction: string | null;
  };
  timelineIntelligence?: {
    active: boolean;
    conversationStatus: ConversationStatus;
    timelineSummary: string;
    escalationScore: number;
  };
  relationship?: SenderRelationshipProfile;
};

const CATEGORY_ACCENT: Record<InboxAiCategory, string> = {
  needs_attention: "border-l-4 border-l-accent bg-accent-muted/25",
  quick_reply: "border-l-4 border-l-teal-500 bg-teal-50/40",
  fyi: "border-l-4 border-l-sky-500 bg-sky-50/30",
  handled: "border-l-4 border-l-emerald-500 bg-emerald-50/30",
  newsletter: "border-l-4 border-l-slate-400 bg-slate-50/50",
  promotion: "border-l-4 border-l-amber-500 bg-amber-50/35",
};

function formatInboxDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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
  isUnread?: boolean;
};

export function GmailInboxCard({
  message,
  locale,
  onCategoryChange,
  onResetOverride,
  selected = false,
  selectionMode = false,
  onToggleSelect,
  isUnread = false,
}: GmailInboxCardProps) {
  const [feedback, setFeedback] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatusState>("idle");
  const [showCorrection, setShowCorrection] = useState(false);
  const [showRelationship, setShowRelationship] = useState(false);
  const [learningPrompt, setLearningPrompt] = useState<string | null>(null);
  const initialLearning = useMemo(
    () => getSenderLearningSuggestion(message.sender, locale)?.message ?? null,
    [message.sender, locale],
  );
  const ui = useUiCopy();
  const guessedRef = useRef(message.category);
  const accent = CATEGORY_ACCENT[message.category];
  const catLabel = inboxCategorySectionTitle(message.category, locale);
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
      (message.category === "newsletter" || message.category === "promotion"));
  const badgeLabel =
    message.category === "promotion"
      ? locale === "it"
        ? "Promozione"
        : "Promotion"
      : locale === "it"
        ? "Newsletter"
        : "Newsletter";

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
        logSenderRuleDebug("submitCategoryFeedback starting", { scope, emailId: message.id });
        const result = await submitCategoryFeedback({
          emailId: message.id,
          sender: message.sender,
          subject: message.subject,
          snippet: message.snippet,
          guessedCategory: guessedRef.current,
          chosenCategory: chosen,
          scope,
        });
        logSenderRuleDebug("submitCategoryFeedback done", {
          scope,
          learnedSender: result.learnedSender,
          message: result.message,
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
        logSenderRuleDebug("submitCategoryFeedback failed", { scope, error: errMsg });
        setFeedback(
          scope === "sender"
            ? errMsg || "Saved on this device — will sync when online."
            : errMsg || "Could not save — try again.",
        );
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
      await handleApply("needs_attention", "sender");
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

  return (
    <div className="group relative flex items-start gap-2">
      {onToggleSelect ? (
        <div
          className={`flex shrink-0 items-center self-stretch pl-0.5 pt-4 transition-opacity duration-150 sm:pt-5 ${
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
      <div
        className={`flex-1 rounded-xl border p-4 shadow-sm transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-5 hover:border-accent/40 hover:shadow-md ${accent} ${
          selected
            ? "border-accent/60 ring-2 ring-[#9733ff]/30"
            : "border-[#E2E8F0]"
        }`}
      >
      <article className="space-y-2">
        <CardHeader
          message={message}
          catLabel={catLabel}
          learnedApplied={learnedApplied}
          manualOverride={manualOverride}
          showNewsletterBadge={showNewsletterBadge}
          badgeLabel={badgeLabel}
          locale={locale}
          isUnread={isUnread}
          onOpenCorrection={() => setShowCorrection(true)}
        />

        {showRelationship ? (
          <RelationshipAssignPanel
            compact
            sender={message.sender}
            onDismiss={() => setShowRelationship(false)}
          />
        ) : null}

        {activeLearningPrompt && !showCorrection && !showRelationship ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
            <p className="text-xs leading-relaxed text-amber-950">{activeLearningPrompt}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void acceptLearningPrioritize()}
                className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900"
              >
                {locale === "it" ? "Sì, prioritarizza" : "Yes, prioritize"}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSenderLearningSuggestion(message.sender);
                  setLearningPrompt(null);
                }}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
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

        <Link
          href={`/emails/${encodeURIComponent(message.id)}`}
          className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => {
            const preview = buildInboxMessagePreview(message, locale);
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
          <h3 className="text-[15px] font-medium leading-snug text-[#0F172A] transition-colors duration-200">
            {message.subject}
          </h3>
        </Link>

        <InboxGlanceLine message={message} locale={locale} />

        {!showCorrection && !showRelationship ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCorrection(true)}
              className="text-xs font-medium text-accent hover:underline"
            >
              Change category or teach Handled…
            </button>
            <button
              type="button"
              onClick={() => setShowRelationship(true)}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              {ui.relationship.assignLink}
            </button>
            {manualOverride && onResetOverride ? (
              <button
                type="button"
                onClick={() => void handleReset()}
                className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline"
              >
                Reset to AI categorization
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus status={saveStatus} />
          {feedback ? <p className="text-xs text-emerald-700">{feedback}</p> : null}
        </div>
      </article>
      </div>
    </div>
  );
}

function buildInboxMessagePreview(message: GmailCardMessage, locale: "en" | "it") {
  const row = {
    sender: message.sender,
    subject: message.subject,
    snippet: message.snippet,
  };
  const summary = buildSituationSummary(row, message.category, {
    category: message.category,
    locale,
    relationship: message.relationship,
  });
  const haystack = `${message.sender} ${message.subject} ${message.snippet}`;
  let continuityLine: string | null = null;
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
      }).lines[0] ?? null;
  }
  const glanceLine = buildInboxGlanceLine(summary, {
    continuityLine,
    nextStep: message.actionIntelligence?.suggestedNextAction ?? null,
    haystack,
    locale,
  });
  return { summary, glanceLine };
}

function InboxGlanceLine({
  message,
  locale,
}: {
  message: GmailCardMessage;
  locale: "en" | "it";
}) {
  const line = buildInboxMessagePreview(message, locale).glanceLine;
  return (
    <p className="text-sm leading-snug text-gray-600 calm-fade-in">{line}</p>
  );
}

function CardHeader({
  message,
  catLabel,
  learnedApplied,
  manualOverride,
  showNewsletterBadge,
  badgeLabel,
  locale,
  isUnread = false,
  onOpenCorrection,
}: {
  message: GmailCardMessage;
  catLabel: string;
  learnedApplied: boolean;
  manualOverride: boolean;
  showNewsletterBadge: boolean;
  badgeLabel: string;
  locale: "en" | "it";
  isUnread?: boolean;
  onOpenCorrection: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p
        className={`flex items-center gap-1.5 text-sm ${
          isUnread ? "font-semibold text-[#0F172A]" : "font-medium text-gray-500"
        }`}
      >
        {isUnread ? (
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#9733ff]"
            title={locale === "it" ? "Da leggere" : "Unread"}
          />
        ) : null}
        {message.sender}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {message.timelineIntelligence?.active &&
        (message.timelineIntelligence.conversationStatus === "escalating" ||
          message.timelineIntelligence.conversationStatus === "stalled") ? (
          <ConversationStatusChip
            status={message.timelineIntelligence.conversationStatus}
            locale={locale}
            compact
          />
        ) : null}
        {message.needsCalendarContext ? (
          <CalendarContextBadge locale={locale} compact showLink={false} />
        ) : null}
        {showNewsletterBadge ? (
          <Link
            href={`/emails/${encodeURIComponent(message.id)}`}
            className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800 hover:bg-violet-100"
          >
            {badgeLabel}
          </Link>
        ) : null}
        {manualOverride ? (
          <span
            className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800"
            title="You moved this email manually"
          >
            You changed this
          </span>
        ) : null}
        {message.relationship ? (
          <RelationshipBadge relationship={message.relationship} />
        ) : null}
        {learnedApplied ? (
          <span
            className="rounded-full border border-accent/20 bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent"
            title="A learned sender rule set this category"
          >
            Rule applied
          </span>
        ) : null}
        <button
          type="button"
          onClick={onOpenCorrection}
          className="max-w-[11rem] rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent transition-colors duration-300 hover:bg-accent-muted"
          aria-label={`Category: ${catLabel}. Click to change.`}
        >
          {catLabel} ▼
        </button>
        <time className="text-xs text-gray-400" dateTime={message.date}>
          {formatInboxDate(message.date)}
        </time>
      </div>
    </div>
  );
}
