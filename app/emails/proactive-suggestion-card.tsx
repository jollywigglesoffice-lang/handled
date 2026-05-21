"use client";

import Link from "next/link";
import type { ProactiveSuggestion } from "@/lib/proactive-assistant";

type ProactiveSuggestionCardProps = {
  suggestion: ProactiveSuggestion;
  onDismiss: (id: string) => void;
  locale: "en" | "it";
  compact?: boolean;
};

export function ProactiveSuggestionCard({
  suggestion,
  onDismiss,
  locale,
  compact,
}: ProactiveSuggestionCardProps) {
  return (
    <article
      className={`rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/40 to-white ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <p className="text-sm leading-relaxed text-[#0F172A]">{suggestion.message}</p>
      {suggestion.calmDetail ? (
        <p className="mt-1 text-xs leading-relaxed text-gray-500">{suggestion.calmDetail}</p>
      ) : null}
      {!compact ? (
        <p className="mt-2 truncate text-xs text-gray-400">
          {suggestion.sender} — {suggestion.subject}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/emails/${encodeURIComponent(suggestion.emailId)}`}
          className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-900 hover:bg-teal-50"
        >
          {locale === "it" ? "Apri email" : "Open email"}
        </Link>
        <button
          type="button"
          onClick={() => onDismiss(suggestion.id)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          {locale === "it" ? "Nascondi" : "Dismiss"}
        </button>
      </div>
    </article>
  );
}
