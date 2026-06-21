"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useEmailCompletions } from "@/app/email-completions-context";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { BetaFocusInboxView } from "@/app/emails/beta-focus-inbox-view";
import { useEmailStatusActions } from "@/app/emails/use-email-status-actions";
import { isFocusModeEnabled } from "@/lib/beta-mode";
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
import { isActiveWaiting } from "@/lib/waiting-on/helpers";

type BetaInboxViewProps = {
  messages: GmailCardMessage[];
  locale: "en" | "it";
  readStateMap: ReadStateMap;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  showAccountBadges?: boolean;
};

const COPY = {
  en: {
    emptyTitle: "You're all caught up",
    emptySubtitle: "New mail will show up here when it needs you.",
    refresh: "Refresh",
    needsAttentionSection: "Needs Attention",
    suggestedSection: "Suggested",
  },
  it: {
    emptyTitle: "Sei in pari",
    emptySubtitle: "La nuova posta apparirà qui quando serve.",
    refresh: "Aggiorna",
    needsAttentionSection: "Richiede attenzione",
    suggestedSection: "Suggerito",
  },
} as const;

export function BetaInboxView(props: BetaInboxViewProps) {
  if (isFocusModeEnabled()) {
    return <BetaFocusInboxView {...props} />;
  }
  return <BetaInboxListView {...props} />;
}

function BetaInboxListView({
  messages,
  locale,
  readStateMap,
  isRefreshing = false,
  onRefresh,
  showAccountBadges = false,
}: BetaInboxViewProps) {
  const t = COPY[locale];
  const { isCompleted, completions } = useEmailCompletions();

  const visibleMessages = useMemo(() => {
    const sorted = sortBetaQueue(messages);
    return sorted.filter((m) => !isCompleted(m.id));
  }, [messages, isCompleted, completions]);

  const stateCounts = countBetaStates(visibleMessages);
  const doneCount = messages.filter((m) => isCompleted(m.id)).length;

  const needsAttention = useMemo(
    () => visibleMessages.filter((m) => resolveBetaEmailState(m) === "worth_your_attention"),
    [visibleMessages],
  );
  const suggested = useMemo(
    () => visibleMessages.filter((m) => resolveBetaEmailState(m) === "suggested"),
    [visibleMessages],
  );

  if (visibleMessages.length === 0) {
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
    <div className="space-y-8">
      <BetaStateBar
        locale={locale}
        needsAttention={stateCounts.worth_your_attention}
        suggested={stateCounts.suggested}
        doneCount={doneCount}
      />

      {needsAttention.length > 0 ? (
        <BetaListSection
          title={t.needsAttentionSection}
          messages={needsAttention}
          locale={locale}
          readStateMap={readStateMap}
          showAccountBadges={showAccountBadges}
        />
      ) : null}

      {suggested.length > 0 ? (
        <BetaListSection
          title={t.suggestedSection}
          messages={suggested}
          locale={locale}
          readStateMap={readStateMap}
          showAccountBadges={showAccountBadges}
        />
      ) : null}
    </div>
  );
}

function BetaListSection({
  title,
  messages,
  locale,
  readStateMap,
  showAccountBadges,
}: {
  title: string;
  messages: GmailCardMessage[];
  locale: "en" | "it";
  readStateMap: ReadStateMap;
  showAccountBadges: boolean;
}) {
  return (
    <section className="space-y-0 divide-y divide-gray-100">
      <h2 className="pb-3 text-xs font-medium uppercase tracking-wide text-gray-400">{title}</h2>
      {messages.map((message) => (
        <BetaInboxListRow
          key={message.id}
          message={message}
          locale={locale}
          readStateMap={readStateMap}
          showAccountBadge={showAccountBadges}
        />
      ))}
    </section>
  );
}

function BetaStateBar({
  locale,
  needsAttention,
  suggested,
  doneCount,
}: {
  locale: "en" | "it";
  needsAttention: number;
  suggested: number;
  doneCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StateChip
        label={betaStateLabel("worth_your_attention", locale)}
        count={needsAttention}
        tone="attention"
      />
      <StateChip
        label={betaStateLabel("suggested", locale)}
        count={suggested}
        tone="suggested"
      />
      {doneCount > 0 ? (
        <StateChip label={betaDoneLabel(locale)} count={doneCount} tone="done" />
      ) : null}
    </div>
  );
}

function StateChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "attention" | "suggested" | "done";
}) {
  const styles = {
    attention: "border-amber-200 bg-amber-50 text-amber-900",
    suggested: "border-violet-200 bg-violet-50 text-violet-900",
    done: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </span>
  );
}

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
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function BetaInboxListRow({
  message,
  locale,
  readStateMap,
  showAccountBadge,
}: {
  message: GmailCardMessage;
  locale: "en" | "it";
  readStateMap: ReadStateMap;
  showAccountBadge: boolean;
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

  const stateTone = betaState === "worth_your_attention" ? "border-l-amber-400" : "border-l-violet-400";
  const isUnread = emailStatus.lifecycle === "unread";

  return (
    <article className={`flex gap-3 border-l-2 py-4 pl-3 ${stateTone}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`truncate text-sm ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}
            >
              {message.sender}
            </p>
            {showAccountBadge && message.accountLabel ? (
              <p className="truncate text-[11px] text-gray-400">{message.accountLabel}</p>
            ) : null}
          </div>
          <span className="shrink-0 text-xs text-gray-400">{formatDate(message.date)}</span>
        </div>

        <Link
          href={detailHref}
          onClick={openDetail}
          className="mt-0.5 block text-sm leading-snug text-gray-900 hover:text-accent"
        >
          <span className={isUnread ? "font-semibold" : "font-medium"}>{message.subject}</span>
        </Link>

        {message.snippet ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
            {message.snippet}
          </p>
        ) : null}

        <span className="mt-2 inline-block text-[11px] font-medium text-gray-400">
          {betaStateLabel(betaState, locale)}
        </span>
      </div>

      <div className="flex shrink-0 flex-col justify-center">
        {primary.behavior === "done" ? (
          <button
            type="button"
            onClick={handleDone}
            disabled={emailStatus.busy}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {primary.label}
          </button>
        ) : (
          <Link
            href={detailHref}
            onClick={openDetail}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover"
          >
            {primary.label}
          </Link>
        )}
      </div>
    </article>
  );
}

/** Done count for beta nav badge. */
export function useBetaDoneCount(): number {
  const { completions } = useEmailCompletions();
  return Object.values(completions).filter((r) => !isActiveWaiting(r)).length;
}
