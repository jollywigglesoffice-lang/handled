"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CompletionActionPicker } from "@/app/emails/completion-action-picker";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import {
  inboxCategorySectionTitle,
  type InboxAiCategory,
} from "@/lib/inbox-ai-categories";
import {
  formatDuration,
  secondsForCategory,
} from "@/lib/inbox-zero/estimate";

export type InboxZeroStep =
  | { kind: "email"; category: InboxAiCategory; message: GmailCardMessage }
  | { kind: "cleanup"; emails: GmailCardMessage[] };

type InboxZeroModeProps = {
  steps: InboxZeroStep[];
  mode: "quick_replies" | "inbox_zero";
  locale: "en" | "it";
  onCompleteEmail: (
    id: string,
    category: InboxAiCategory,
    actionId: CompletionActionId,
    actionLabel: string,
  ) => void;
  onClearPromotions: (ids: string[]) => void;
  onFinished: (stats: { processed: number; timeSavedSeconds: number }) => void;
  onClose: () => void;
};

type Copy = {
  quickRepliesTitle: string;
  inboxZeroTitle: string;
  stepOf: (a: number, b: number) => string;
  open: string;
  skip: string;
  complete: string;
  next: string;
  clear: (n: number) => string;
  cleanupHint: string;
  done: string;
  inboxZeroReached: string;
  quickRepliesDone: string;
  processed: string;
  timeSaved: string;
  nothingHere: string;
  close: string;
};

const COPY: Record<"en" | "it", Copy> = {
  en: {
    quickRepliesTitle: "Quick replies",
    inboxZeroTitle: "Inbox Zero",
    stepOf: (a: number, b: number) => `${a} of ${b}`,
    open: "Open",
    skip: "Skip",
    complete: "Complete",
    next: "Next",
    clear: (n: number) => `Clear ${n} promotion${n === 1 ? "" : "s"}`,
    cleanupHint: "Move everything promotional out of the way.",
    done: "Done",
    inboxZeroReached: "Inbox Zero",
    quickRepliesDone: "Quick replies done",
    processed: "Emails processed",
    timeSaved: "Time saved",
    nothingHere: "Nothing to process here.",
    close: "Close",
  },
  it: {
    quickRepliesTitle: "Risposte veloci",
    inboxZeroTitle: "Inbox Zero",
    stepOf: (a: number, b: number) => `${a} di ${b}`,
    open: "Apri",
    skip: "Salta",
    complete: "Fatto",
    next: "Avanti",
    clear: (n: number) => `Svuota ${n} promozion${n === 1 ? "e" : "i"}`,
    cleanupHint: "Togli di mezzo tutto il promozionale.",
    done: "Fine",
    inboxZeroReached: "Inbox Zero",
    quickRepliesDone: "Risposte veloci completate",
    processed: "Email gestite",
    timeSaved: "Tempo risparmiato",
    nothingHere: "Niente da gestire qui.",
    close: "Chiudi",
  },
};

export function InboxZeroMode({
  steps,
  mode,
  locale,
  onCompleteEmail,
  onClearPromotions,
  onFinished,
  onClose,
}: InboxZeroModeProps) {
  const t = COPY[locale];
  const [index, setIndex] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [timeSaved, setTimeSaved] = useState(0);
  const [finished, setFinished] = useState(false);

  const total = steps.length;
  const isComplete = index >= total;

  useEffect(() => {
    if (isComplete && !finished) {
      setFinished(true);
      onFinished({ processed, timeSavedSeconds: timeSaved });
    }
  }, [isComplete, finished, onFinished, processed, timeSaved]);

  const advance = useCallback(() => setIndex((i) => i + 1), []);

  const current = steps[index];

  const completeEmail = useCallback(
    (actionId: CompletionActionId, actionLabel: string) => {
      if (!current || current.kind !== "email") return;
      onCompleteEmail(current.message.id, current.category, actionId, actionLabel);
      setProcessed((n) => n + 1);
      setTimeSaved((s) => s + secondsForCategory(current.category));
      advance();
    },
    [current, onCompleteEmail, advance],
  );

  const doCleanup = useCallback(() => {
    if (!current || current.kind !== "cleanup") return;
    const ids = current.emails.map((m) => m.id);
    onClearPromotions(ids);
    setProcessed((n) => n + ids.length);
    setTimeSaved((s) => s + ids.length * secondsForCategory("promotion"));
    advance();
  }, [current, onClearPromotions, advance]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const heading = mode === "inbox_zero" ? t.inboxZeroTitle : t.quickRepliesTitle;
  const progressPct = total === 0 ? 100 : Math.round((index / total) * 100);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label={t.close}
        onClick={onClose}
        className="absolute inset-0 bg-[#0F172A]/30 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-7 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.5)] sm:p-9">
        {!isComplete ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{heading}</p>
              <p className="text-xs tabular-nums text-gray-400">
                {t.stepOf(Math.min(index + 1, total), total)}
              </p>
            </div>

            <div className="mb-7 h-1 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#9733ff] transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {current?.kind === "email" ? (
              <EmailStep
                message={current.message}
                category={current.category}
                locale={locale}
                t={t}
                onComplete={completeEmail}
                onSkip={advance}
              />
            ) : current?.kind === "cleanup" ? (
              <CleanupStep count={current.emails.length} t={t} onClear={doCleanup} />
            ) : (
              <p className="py-10 text-center text-sm text-gray-500">{t.nothingHere}</p>
            )}
          </>
        ) : (
          <CompletionScreen
            mode={mode}
            processed={processed}
            timeSaved={timeSaved}
            locale={locale}
            t={t}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function EmailStep({
  message,
  category,
  locale,
  t,
  onComplete,
  onSkip,
}: {
  message: GmailCardMessage;
  category: InboxAiCategory;
  locale: "en" | "it";
  t: Copy;
  onComplete: (actionId: CompletionActionId, actionLabel: string) => void;
  onSkip: () => void;
}) {
  const [showDone, setShowDone] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="inline-flex rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
          {inboxCategorySectionTitle(category, locale)}
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-500">{message.sender}</p>
        <h3 className="text-lg font-semibold leading-snug text-[#0F172A]">
          {message.subject || "(no subject)"}
        </h3>
        {message.snippet ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-gray-500">{message.snippet}</p>
        ) : null}
      </div>

      {showDone ? (
        <CompletionActionPicker
          locale={locale}
          onSelect={(id, label) => {
            onComplete(id, label);
            setShowDone(false);
          }}
          showCreate={false}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowDone(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <CheckGlyph />
            {locale === "it" ? "✓ Fatto con questa" : "✓ Done with this"}
          </button>
          <Link
            href={`/emails/${encodeURIComponent(message.id)}`}
            target="_blank"
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t.open}
          </Link>
          <button
            type="button"
            onClick={onSkip}
            className="ml-auto rounded-xl px-4 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            {t.skip}
            <span aria-hidden className="ml-1">→</span>
          </button>
        </div>
      )}
    </div>
  );
}

function CleanupStep({
  count,
  t,
  onClear,
}: {
  count: number;
  t: Copy;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted ring-1 ring-accent/15"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#9733ff]" fill="none">
          <path
            d="M5 7h14M9.5 7V5.5a1 1 0 011-1h3a1 1 0 011 1V7m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="text-base text-gray-600">{t.cleanupHint}</p>
      <button
        type="button"
        onClick={onClear}
        className="rounded-xl bg-[#9733ff] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9733ff] focus-visible:ring-offset-2"
      >
        {t.clear(count)}
      </button>
    </div>
  );
}

function CompletionScreen({
  mode,
  processed,
  timeSaved,
  locale,
  t,
  onClose,
}: {
  mode: "quick_replies" | "inbox_zero";
  processed: number;
  timeSaved: number;
  locale: "en" | "it";
  t: Copy;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="text-4xl" aria-hidden>
        {mode === "inbox_zero" ? "🎉" : "✓"}
      </div>
      <h3 className="text-2xl font-semibold text-[#0F172A]">
        {mode === "inbox_zero" ? t.inboxZeroReached : t.quickRepliesDone}
      </h3>

      <div className="flex items-stretch gap-10">
        <div className="flex flex-col">
          <span className="text-2xl font-semibold tabular-nums text-accent">{processed}</span>
          <span className="mt-1 text-xs text-gray-400">{t.processed}</span>
        </div>
        <div className="w-px bg-gray-100" aria-hidden />
        <div className="flex flex-col">
          <span className="text-2xl font-semibold text-accent">
            {formatDuration(timeSaved, locale)}
          </span>
          <span className="mt-1 text-xs text-gray-400">{t.timeSaved}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-2 rounded-xl bg-[#9733ff] px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9733ff] focus-visible:ring-offset-2"
      >
        {t.done}
      </button>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4.5 10.5l3 3 8-8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
