"use client";

/**
 * Dormant Focus Mode — single-email queue with auto-advance.
 * NOT active by default. Routed from BetaInboxView when NEXT_PUBLIC_FOCUS_MODE=true.
 */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useEmailCompletions } from "@/app/email-completions-context";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { useEmailStatusActions } from "@/app/emails/use-email-status-actions";
import { BETA_FOCUS_INBOX_LIMIT } from "@/lib/beta-inbox/focus-mode";
import {
  betaDoneLabel,
  betaStateLabel,
  countBetaStates,
  resolveBetaEmailState,
  resolveBetaPrimaryAction,
  sortBetaQueue,
} from "@/lib/beta-inbox/state";
import { logAssistedConfirmation } from "@/lib/autopilot/execute";
import { saveEmailPreview } from "@/lib/email-preview-cache";
import type { ReadStateMap } from "@/lib/read-state/client-storage";

type BetaFocusInboxViewProps = {
  messages: GmailCardMessage[];
  locale: "en" | "it";
  readStateMap: ReadStateMap;
  isRefreshing?: boolean;
  onRefresh?: () => void;
};

const COPY = {
  en: {
    subtitle: "One email at a time — tap the action and move on.",
    progress: (done: number, total: number) => `${done} of ${total} done`,
    emptyTitle: "You're all caught up",
    emptySubtitle: "New mail will show up here when it needs you.",
    refresh: "Refresh",
  },
  it: {
    subtitle: "Un'email alla volta — tocca l'azione e vai avanti.",
    progress: (done: number, total: number) => `${done} di ${total} fatte`,
    emptyTitle: "Sei in pari",
    emptySubtitle: "La nuova posta apparirà qui quando serve.",
    refresh: "Aggiorna",
  },
} as const;

function emailDetailHref(message: GmailCardMessage): string {
  const base = `/emails/${encodeURIComponent(message.id)}`;
  if (message.accountId) {
    return `${base}?accountId=${encodeURIComponent(message.accountId)}`;
  }
  return base;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function BetaFocusInboxView({
  messages,
  locale,
  readStateMap,
  isRefreshing = false,
  onRefresh,
}: BetaFocusInboxViewProps) {
  const t = COPY[locale];
  const { isCompleted, completions } = useEmailCompletions();
  const [focusIndex, setFocusIndex] = useState(0);

  const initialQueue = useMemo(
    () => sortBetaQueue(messages).slice(0, BETA_FOCUS_INBOX_LIMIT),
    [messages],
  );

  const activeQueue = useMemo(
    () => initialQueue.filter((m) => !isCompleted(m.id)),
    [initialQueue, isCompleted, completions],
  );

  const safeIndex = Math.min(focusIndex, Math.max(0, activeQueue.length - 1));
  const current = activeQueue[safeIndex];
  const stateCounts = countBetaStates(activeQueue);
  const doneCount = initialQueue.length - activeQueue.length;
  const totalCount = initialQueue.length;

  const advance = useCallback(() => {
    setFocusIndex((i) => Math.min(i, Math.max(0, activeQueue.length - 2)));
  }, [activeQueue.length]);

  if (!current) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-lg font-semibold text-gray-900">{t.emptyTitle}</p>
        <p className="mt-2 text-sm text-gray-500">{t.emptySubtitle}</p>
        {doneCount > 0 ? (
          <p className="mt-4 text-sm font-medium text-accent">
            {betaDoneLabel(locale)}: {doneCount}
          </p>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn-primary-sm mt-6"
          >
            {t.refresh}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-center text-xs text-gray-400">
        {t.progress(doneCount, totalCount)} · {t.subtitle}
      </p>

      <BetaFocusCard
        key={current.id}
        message={current}
        locale={locale}
        readStateMap={readStateMap}
        onAdvance={advance}
        stateCounts={stateCounts}
        doneCount={doneCount}
      />

      {activeQueue.length > 1 ? (
        <p className="text-center text-xs text-gray-400">
          {activeQueue.length - safeIndex - 1}{" "}
          {locale === "it" ? "ancora in coda" : "more in queue"}
        </p>
      ) : null}
    </div>
  );
}

function BetaFocusCard({
  message,
  locale,
  readStateMap,
  onAdvance,
  stateCounts,
  doneCount,
}: {
  message: GmailCardMessage;
  locale: "en" | "it";
  readStateMap: ReadStateMap;
  onAdvance: () => void;
  stateCounts: { worth_your_attention: number; suggested: number };
  doneCount: number;
}) {
  const betaState = resolveBetaEmailState(message);
  const primary = resolveBetaPrimaryAction(message, locale);
  const detailHref = emailDetailHref(message);

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
      onAdvance();
    },
  });

  const handleDone = useCallback(() => {
    const label = locale === "it" ? "Fatto" : "Done";
    void emailStatus.handleComplete("no_action_needed", label);
  }, [emailStatus, locale]);

  const openDetail = useCallback(() => {
    saveEmailPreview({
      id: message.id,
      sender: message.sender,
      subject: message.subject,
      snippet: message.snippet,
    });
    emailStatus.handleMarkRead();
  }, [message, emailStatus]);

  const stateTone =
    betaState === "worth_your_attention" ? "border-l-amber-400" : "border-l-violet-400";

  return (
    <article
      className={`rounded-2xl border border-gray-100 border-l-4 bg-white px-5 py-6 shadow-sm ${stateTone}`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
          {betaStateLabel("worth_your_attention", locale)} {stateCounts.worth_your_attention}
        </span>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-900">
          {betaStateLabel("suggested", locale)} {stateCounts.suggested}
        </span>
        {doneCount > 0 ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
            {betaDoneLabel(locale)} {doneCount}
          </span>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-gray-400">
          {betaStateLabel(betaState, locale)}
        </span>
        <span className="shrink-0 text-xs text-gray-400">{formatDate(message.date)}</span>
      </div>

      <p className="mt-3 text-sm font-semibold text-gray-900">{message.sender}</p>
      <h2 className="mt-1 text-lg font-medium leading-snug text-gray-900">{message.subject}</h2>
      {message.snippet ? (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-500">
          {message.snippet}
        </p>
      ) : null}

      <div className="mt-6">
        {primary.behavior === "done" ? (
          <button
            type="button"
            onClick={handleDone}
            disabled={emailStatus.busy}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {primary.label}
          </button>
        ) : (
          <Link
            href={detailHref}
            onClick={openDetail}
            className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            {primary.label}
          </Link>
        )}
      </div>
    </article>
  );
}
