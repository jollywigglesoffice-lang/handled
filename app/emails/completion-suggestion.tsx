"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCompletionActions } from "@/app/completion-actions-context";
import { useEmailCompletions } from "@/app/email-completions-context";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import { trackEvent } from "@/lib/analytics";
import {
  completionSuggestionExplanation,
  suggestCompletionAction,
} from "@/lib/completion-learning/suggest";
import { shouldSuppressCompletionSuggestion } from "@/lib/completion-actions/context-filter";
import type { CompleteEmailExtras } from "@/lib/email-completions/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

type CompletionSuggestionProps = {
  emailId: string;
  sender: string;
  subject: string;
  category: InboxAiCategory;
  locale: "en" | "it";
  busy?: boolean;
  categoryConfidence?: number;
  actionable?: boolean;
  actionState?: import("@/lib/action-intelligence").EmailActionState;
  onSelect: (
    actionId: CompletionActionId,
    actionLabel: string,
    extras?: CompleteEmailExtras,
  ) => void;
};

const DISMISS_PREFIX = "handled_suggest_dismiss_";

const COPY = {
  en: {
    suggestedAction: "Suggested action",
    notNow: "Not now",
  },
  it: {
    suggestedAction: "Azione suggerita",
    notNow: "Non ora",
  },
} as const;

export function CompletionSuggestion({
  emailId,
  sender,
  subject,
  category,
  locale,
  busy,
  categoryConfidence,
  actionable,
  actionState,
  onSelect,
}: CompletionSuggestionProps) {
  const { learning } = useEmailCompletions();
  const { catalog } = useCompletionActions();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(`${DISMISS_PREFIX}${emailId}`) === "1";
    } catch {
      return false;
    }
  });
  const generatedRef = useRef(false);
  const shownRef = useRef(false);
  const t = COPY[locale];

  const rawSuggestion = useMemo(
    () =>
      suggestCompletionAction(
        learning,
        { sender, subject, category },
        (id) => catalog.labelFor(id, locale),
      ),
    [learning, sender, subject, category, catalog, locale],
  );

  const suggestion = useMemo(() => {
    if (dismissed || !rawSuggestion) return null;
    if (actionState === "passive") return null;
    if (
      shouldSuppressCompletionSuggestion(rawSuggestion.actionId, {
        category,
        categoryConfidence,
        actionable,
        actionState,
        suggestionConfidence: rawSuggestion.confidence,
      })
    ) {
      return null;
    }
    return rawSuggestion;
  }, [dismissed, rawSuggestion, category, categoryConfidence, actionable, actionState]);

  useEffect(() => {
    if (!rawSuggestion || generatedRef.current) return;
    generatedRef.current = true;
    trackEvent("completion_suggestion_generated", {
      email_id: emailId,
      action_id: rawSuggestion.actionId,
      sample_count: rawSuggestion.sampleCount,
      scope: rawSuggestion.scope,
      completion_pattern: rawSuggestion.completionPattern,
      surface: "detail",
    });
  }, [rawSuggestion, emailId]);

  useEffect(() => {
    if (!suggestion || shownRef.current) return;
    shownRef.current = true;
    trackEvent("completion_suggestion_shown", {
      email_id: emailId,
      action_id: suggestion.actionId,
      sample_count: suggestion.sampleCount,
      scope: suggestion.scope,
      completion_pattern: suggestion.completionPattern,
      surface: "detail",
    });
  }, [suggestion, emailId]);

  if (!suggestion) return null;

  const explanation = completionSuggestionExplanation(suggestion, locale);

  function handleUse() {
    trackEvent("completion_suggestion_used", {
      email_id: emailId,
      action_id: suggestion!.actionId,
      sample_count: suggestion!.sampleCount,
      scope: suggestion!.scope,
      completion_pattern: suggestion!.completionPattern,
      surface: "detail",
    });
    onSelect(suggestion!.actionId, suggestion!.actionLabel);
  }

  function handleDismiss() {
    trackEvent("completion_suggestion_dismissed", {
      email_id: emailId,
      action_id: suggestion!.actionId,
      sample_count: suggestion!.sampleCount,
      scope: suggestion!.scope,
      surface: "detail",
    });
    try {
      sessionStorage.setItem(`${DISMISS_PREFIX}${emailId}`, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">
          {t.suggestedAction}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-gray-400 transition hover:text-gray-600"
        >
          {t.notNow}
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handleUse}
        className="mt-2 flex w-full items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
      >
        <span className="text-emerald-600" aria-hidden>
          ✓
        </span>
        {suggestion.actionLabel}
      </button>
      <p className="mt-1.5 text-xs text-gray-500">{explanation}</p>
    </div>
  );
}
