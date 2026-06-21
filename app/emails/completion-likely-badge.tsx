"use client";

import { useEffect, useMemo, useRef } from "react";
import { useCompletionActions } from "@/app/completion-actions-context";
import { useEmailCompletions } from "@/app/email-completions-context";
import { trackEvent } from "@/lib/analytics";
import {
  qualifiesForInboxBadge,
  suggestCompletionAction,
} from "@/lib/completion-learning/suggest";
import type { EmailActionState } from "@/lib/action-intelligence/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

type CompletionLikelyBadgeProps = {
  emailId: string;
  sender: string;
  subject: string;
  category: InboxAiCategory;
  locale: "en" | "it";
  actionState?: EmailActionState;
};

const COPY = {
  en: { likely: "Likely:" },
  it: { likely: "Probabile:" },
} as const;

export function CompletionLikelyBadge({
  emailId,
  sender,
  subject,
  category,
  locale,
  actionState,
}: CompletionLikelyBadgeProps) {
  const { learning } = useEmailCompletions();
  const { catalog } = useCompletionActions();
  const shownRef = useRef(false);
  const t = COPY[locale];

  const suggestion = useMemo(() => {
    if (actionState === "passive") return null;
    const raw = suggestCompletionAction(
      learning,
      { sender, subject, category },
      (id) => catalog.labelFor(id, locale),
    );
    if (!raw || !qualifiesForInboxBadge(raw)) return null;
    return raw;
  }, [learning, sender, subject, category, catalog, locale, actionState]);

  useEffect(() => {
    if (!suggestion || shownRef.current) return;
    shownRef.current = true;
    trackEvent("completion_suggestion_generated", {
      email_id: emailId,
      action_id: suggestion.actionId,
      sample_count: suggestion.sampleCount,
      scope: suggestion.scope,
      completion_pattern: suggestion.completionPattern,
      surface: "inbox_badge",
    });
    trackEvent("completion_suggestion_shown", {
      email_id: emailId,
      action_id: suggestion.actionId,
      sample_count: suggestion.sampleCount,
      scope: suggestion.scope,
      completion_pattern: suggestion.completionPattern,
      surface: "inbox_badge",
    });
  }, [suggestion, emailId]);

  if (!suggestion) return null;

  return (
    <span
      className="rounded-full border border-emerald-100 bg-emerald-50/50 px-2 py-0.5 text-[10px] font-medium text-emerald-800/80"
      title={
        locale === "it"
          ? `Di solito finisci email simili come: ${suggestion.actionLabel}`
          : `You usually finish similar emails as: ${suggestion.actionLabel}`
      }
    >
      {t.likely} {suggestion.actionLabel}
    </span>
  );
}
