"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import {
  type InboxAiCategory,
  inboxCategorySectionTitle,
} from "@/lib/inbox-ai-categories";
import type { CategorySource } from "@/lib/inbox-ai-categories";
import { CategoryCorrectionPanel } from "@/app/emails/category-correction-panel";
import { submitCategoryFeedback } from "@/lib/apply-category-feedback";
import type { CategoryApplyScope } from "@/lib/category-correction";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import { shouldShowUnsubscribeInboxBadge } from "@/lib/workflow-mode-unsubscribe";

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
};

const CATEGORY_ACCENT: Record<InboxAiCategory, string> = {
  needs_attention: "border-l-4 border-l-[#6366F1] bg-[#EEF2FF]/25",
  quick_reply: "border-l-4 border-l-teal-500 bg-teal-50/40",
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
};

export function GmailInboxCard({
  message,
  locale,
  onCategoryChange,
  onResetOverride,
}: GmailInboxCardProps) {
  const [feedback, setFeedback] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatusState>("idle");
  const [showCorrection, setShowCorrection] = useState(false);
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
    message.category === "promotion" ? "Promotion detected" : "Newsletter detected";

  const handleApply = useCallback(
    async (chosen: InboxAiCategory, scope: CategoryApplyScope) => {
      const options: InboxCategoryChangeOptions =
        scope === "sender" ? { scope, sender: message.sender } : { scope };

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
        });
        const extra =
          scope === "sender" ? " Matching emails in your inbox were updated." : "";
        setFeedback(`${result.message}${extra}`);
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
      } catch {
        setFeedback(
          scope === "sender"
            ? "Saved on this device — will sync when online."
            : "Could not save — try again.",
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
      setFeedback("Could not reset — try again.");
      setSaveStatus("error");
    }
    window.setTimeout(() => setSaveStatus("idle"), 2500);
  }, [message.id, onResetOverride]);

  return (
    <div
      className={`rounded-xl border border-[#E2E8F0] p-6 shadow-sm transition-all duration-200 hover:border-[#6366F1]/40 hover:shadow-md ${accent}`}
    >
      <article className="space-y-3">
        <CardHeader
          message={message}
          catLabel={catLabel}
          learnedApplied={learnedApplied}
          manualOverride={manualOverride}
          showNewsletterBadge={showNewsletterBadge}
          badgeLabel={badgeLabel}
          onOpenCorrection={() => setShowCorrection(true)}
        />

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
          className="block space-y-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        >
          <h3 className="text-base font-medium text-[#0F172A]">{message.subject}</h3>
          <p className="text-sm leading-relaxed text-gray-500">{message.snippet}</p>
        </Link>

        {!showCorrection ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCorrection(true)}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Change category or teach Handled…
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
  );
}

function CardHeader({
  message,
  catLabel,
  learnedApplied,
  manualOverride,
  showNewsletterBadge,
  badgeLabel,
  onOpenCorrection,
}: {
  message: GmailCardMessage;
  catLabel: string;
  learnedApplied: boolean;
  manualOverride: boolean;
  showNewsletterBadge: boolean;
  badgeLabel: string;
  onOpenCorrection: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium text-gray-500">{message.sender}</p>
      <div className="flex flex-wrap items-center gap-2">
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
        {learnedApplied ? (
          <span
            className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
            title="A learned sender rule set this category"
          >
            Rule applied
          </span>
        ) : null}
        <button
          type="button"
          onClick={onOpenCorrection}
          className="max-w-[11rem] rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6366F1] hover:bg-indigo-50"
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
