"use client";

import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { GuideMessage } from "@/app/onboarding/guide-message";
import {
  emailTrainingKey,
  getTrainingHint,
  isMessageClassified,
  type TrainingClassifications,
} from "@/lib/onboarding/category-training";
import type { TrainingLocale } from "@/lib/onboarding/training-copy";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

type TrainingStepCopy = {
  prompt: string;
  explanation: string;
  addToCategory: string;
  showMore: string;
  skip: string;
  continue: string;
  remaining: (n: number) => string;
  classified: (n: number) => string;
  waitingForMail: string;
  emptyInbox: string;
  suggestion: (label: string) => string;
};

export type CategoryTrainingStepProps = {
  copy: TrainingStepCopy;
  locale: TrainingLocale;
  category: InboxAiCategory;
  examples: GmailCardMessage[];
  classifications: TrainingClassifications;
  remainingCount: number;
  classifiedInStep: number;
  messagesReady: boolean;
  emptyInbox: boolean;
  examplesFetching: boolean;
  onClassify: (message: GmailCardMessage) => void;
  onShowMore: () => void;
  onSkip: () => void;
  onContinue: () => void;
};

function formatInboxDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CategoryTrainingStep({
  copy,
  locale,
  category,
  examples,
  classifications,
  remainingCount,
  classifiedInStep,
  messagesReady,
  emptyInbox,
  examplesFetching,
  onClassify,
  onShowMore,
  onSkip,
  onContinue,
}: CategoryTrainingStepProps) {
  return (
    <section className="space-y-4">
      <GuideMessage>{copy.prompt}</GuideMessage>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm leading-relaxed text-gray-600">{copy.explanation}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-medium text-gray-500">{copy.remaining(remainingCount)}</span>
          {classifiedInStep > 0 ? (
            <span className="font-medium text-accent">{copy.classified(classifiedInStep)}</span>
          ) : null}
        </div>

        {emptyInbox ? (
          <p className="mt-4 text-sm text-gray-500">{copy.emptyInbox}</p>
        ) : !messagesReady ? (
          <p className="mt-4 text-sm text-gray-400">{copy.waitingForMail}</p>
        ) : examples.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{copy.emptyInbox}</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {examples.map((message) => {
              const classified = isMessageClassified(message, classifications);
              const hint = getTrainingHint(message);
              const hintLabel =
                hint && hint !== category
                  ? copy.suggestion(inboxCategorySectionTitle(hint, locale))
                  : null;

              return (
                <li
                  key={emailTrainingKey(message)}
                  className={`rounded-xl border px-4 py-3 transition ${
                    classified
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-gray-100 bg-gray-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{message.sender}</p>
                      <p className="mt-0.5 truncate text-sm text-gray-700">{message.subject}</p>
                      {message.snippet ? (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{message.snippet}</p>
                      ) : null}
                      {hintLabel ? (
                        <p className="mt-2 text-xs text-gray-400">{hintLabel}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatInboxDate(message.date)}
                    </span>
                  </div>
                  {!classified ? (
                    <button
                      type="button"
                      onClick={() => onClassify(message)}
                      className="mt-3 w-full rounded-lg border border-accent/30 bg-white px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent-muted/20"
                    >
                      {copy.addToCategory}
                    </button>
                  ) : (
                    <p className="mt-3 text-xs font-medium text-emerald-700">
                      ✓ {inboxCategorySectionTitle(category, locale)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {messagesReady && !emptyInbox ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onShowMore}
              disabled={examplesFetching || remainingCount === 0}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {examplesFetching ? "…" : copy.showMore}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onContinue} className="btn-primary flex-1">
          {copy.continue}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          {copy.skip}
        </button>
      </div>
    </section>
  );
}
