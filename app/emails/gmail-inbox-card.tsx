"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  type InboxAiCategory,
  inboxCategorySectionTitle,
} from "@/lib/inbox-ai-categories";
import type { CategorySource } from "@/lib/inbox-ai-categories";
import { CategoryCorrectionPanel } from "@/app/emails/category-correction-panel";
import { submitCategoryFeedback } from "@/lib/apply-category-feedback";
import type { CategoryApplyScope } from "@/lib/category-correction";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";

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
};

export function GmailInboxCard({ message, locale, onCategoryChange }: GmailInboxCardProps) {
  const [feedback, setFeedback] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const guessedRef = useRef(message.category);
  const accent = CATEGORY_ACCENT[message.category];
  const catLabel = inboxCategorySectionTitle(message.category, locale);
  const learnedApplied = message.categorySource === "sender_rule";
  const showNewsletterBadge = Boolean(
    message.category === "newsletter" ||
      message.category === "promotion" ||
      message.hasUnsubscribeSignal,
  );
  const badgeLabel =
    message.category === "promotion" ? "Promotion detected" : "Newsletter detected";

  const handleApply = useCallback(
    async (chosen: InboxAiCategory, scope: CategoryApplyScope) => {
      const options: InboxCategoryChangeOptions =
        scope === "sender" ? { scope, sender: message.sender } : { scope };

      onCategoryChange(message.id, chosen, options);

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
        guessedRef.current = chosen;
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
      }
      setShowCorrection(false);
    },
    [message, onCategoryChange],
  );

  return (
    <div
      className={`rounded-xl border border-[#E2E8F0] p-6 shadow-sm transition-all duration-200 hover:border-[#6366F1]/40 hover:shadow-md ${accent}`}
    >
      <article className="space-y-3">
        <CardHeader
          message={message}
          catLabel={catLabel}
          learnedApplied={learnedApplied}
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
          <button
            type="button"
            onClick={() => setShowCorrection(true)}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Change category or teach Handled…
          </button>
        ) : null}

        {feedback ? <p className="text-xs text-emerald-700">{feedback}</p> : null}
      </article>
    </div>
  );
}

function CardHeader({
  message,
  catLabel,
  learnedApplied,
  showNewsletterBadge,
  badgeLabel,
  onOpenCorrection,
}: {
  message: GmailCardMessage;
  catLabel: string;
  learnedApplied: boolean;
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
        {learnedApplied ? (
          <span
            className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
            title="A learned sender rule set this category"
          >
            Learned rule applied
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
