"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  type InboxAiCategory,
  inboxCategorySectionTitle,
} from "@/lib/inbox-ai-categories";
import {
  loadClientSenderPreferences,
  preferenceFromSender,
  saveClientSenderPreferences,
} from "@/lib/inbox-sender-preferences";
import { loadClientInboxRules, saveClientInboxRules } from "@/lib/inbox-rules-client-storage";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type GmailCardMessage = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  category: InboxAiCategory;
  categoryConfidence?: number;
  categorySource?: string;
};

const CATEGORY_OPTIONS: InboxAiCategory[] = [
  "needs_attention",
  "quick_reply",
  "promotion",
  "newsletter",
  "handled",
];

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
  onCategoryChange: (id: string, category: InboxAiCategory) => void;
};

export function GmailInboxCard({ message, locale, onCategoryChange }: GmailInboxCardProps) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const accent = CATEGORY_ACCENT[message.category];
  const catLabel = inboxCategorySectionTitle(message.category, locale);

  const rememberSender = useCallback(
    async (category: InboxAiCategory, always: boolean) => {
      setSaving(true);
      setFeedback("");
      const clientPrefs = loadClientSenderPreferences();
      const pref = preferenceFromSender(
        message.sender,
        category,
        always ? `Always: ${category.replace(/_/g, " ")}` : undefined,
      );
      const merged = [pref, ...clientPrefs.filter((p) => p.senderEmail !== pref.senderEmail)];
      saveClientSenderPreferences(merged);

      try {
        const res = await fetch("/api/inbox-feedback", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "remember_sender_category",
            sender: message.sender,
            category,
            alwaysForSender: always,
            clientPreferences: merged,
            clientRules: loadClientInboxRules(),
          }),
        });
        const data = (await res.json()) as { message?: string; rules?: InboxUserRule[] };
        if (data.rules?.length) {
          saveClientInboxRules(data.rules);
        }
        setFeedback(data.message ?? "Handled will remember this sender.");
        onCategoryChange(message.id, category);
        window.dispatchEvent(new Event("handled-inbox-rules-changed"));
        window.dispatchEvent(new Event("handled-sender-preferences-changed"));
      } catch {
        setFeedback("Saved on this device — applies on next refresh.");
        onCategoryChange(message.id, category);
      } finally {
        setSaving(false);
      }
    },
    [message.id, message.sender, onCategoryChange],
  );

  return (
    <div
      className={`rounded-xl border border-[#E2E8F0] p-6 shadow-sm transition-all duration-200 hover:border-[#6366F1]/40 hover:shadow-md ${accent}`}
    >
      <article className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-500">{message.sender}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={message.category}
              disabled={saving}
              onChange={(e) => {
                const next = e.target.value as InboxAiCategory;
                onCategoryChange(message.id, next);
                void rememberSender(next, false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-[11rem] rounded-full border border-[#E2E8F0] bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6366F1] outline-none focus:border-[#6366F1]"
              aria-label={`Category: ${catLabel}`}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {inboxCategorySectionTitle(c, "en")}
                </option>
              ))}
            </select>
            <time className="text-xs text-gray-400" dateTime={message.date}>
              {formatInboxDate(message.date)}
            </time>
          </div>
        </div>

        <Link
          href={`/emails/${encodeURIComponent(message.id)}`}
          className="block space-y-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        >
          <h3 className="text-base font-medium text-[#0F172A]">{message.subject}</h3>
          <p className="text-sm leading-relaxed text-gray-500">{message.snippet}</p>
        </Link>

        <CardLearnActions
          saving={saving}
          onPromotions={() => void rememberSender("promotion", true)}
          onPrioritize={() => void rememberSender("needs_attention", true)}
          onWrong={() =>
            void rememberSender(
              message.category === "promotion" ? "needs_attention" : "promotion",
              true,
            )
          }
        />

        {feedback ? <p className="text-xs text-emerald-700">{feedback}</p> : null}
      </article>
    </div>
  );
}

function CardLearnActions({
  saving,
  onPromotions,
  onPrioritize,
  onWrong,
}: {
  saving: boolean;
  onPromotions: () => void;
  onPrioritize: () => void;
  onWrong: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-[#E2E8F0]/80 pt-3">
      <button
        type="button"
        disabled={saving}
        onClick={onPromotions}
        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
      >
        Move future mail to Promotions
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onPrioritize}
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
      >
        Always prioritize this sender
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onWrong}
        className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-[#F8FAFC] disabled:opacity-50"
      >
        This categorization was wrong
      </button>
    </div>
  );
}
