"use client";

import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { EmailActions } from "@/app/emails/[id]/email-actions";
import { EmailBody } from "@/app/emails/[id]/email-body";
import { useEmailStatusActions } from "@/app/emails/use-email-status-actions";
import { useGmailEmailDetail } from "@/app/emails/use-gmail-email-detail";
import { CalmTypingIndicator } from "@/app/components/calm-loading";
import { SmartReplyPanel } from "@/app/emails/smart-reply-panel";
import { FirstTimeSuccessScreen } from "@/app/onboarding/first-time-success-screen";
import { logAssistedConfirmation } from "@/lib/autopilot/execute";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import { markEmailsRead } from "@/lib/read-state/gmail-sync";

export type InboxOnboardingFlowProps = {
  queue: GmailCardMessage[];
  locale: "en" | "it";
  readStateMap: ReadStateMap;
  onFinished: (choice: "inbox" | "focus") => void;
};

const COPY = {
  en: {
    progress: (completed: number, total: number) =>
      `${completed} of ${total} email${total === 1 ? "" : "s"} completed`,
    reply: "Reply",
    done: "Done",
    viewFull: "View full email",
    back: "Back",
    loadError: "Could not load full email.",
    retry: "Retry",
  },
  it: {
    progress: (completed: number, total: number) =>
      `${completed} di ${total} email completat${total === 1 ? "a" : "e"}`,
    reply: "Rispondi",
    done: "Fatto",
    viewFull: "Vedi email completa",
    back: "Indietro",
    loadError: "Impossibile caricare l'email.",
    retry: "Riprova",
  },
} as const;

/** Interactive first-run flow — only shown after the inbox has fully loaded. */
export function InboxOnboardingFlow({
  queue,
  locale,
  readStateMap,
  onFinished,
}: InboxOnboardingFlowProps) {
  const t = COPY[locale];
  const [processedIds, setProcessedIds] = useState<Set<string>>(() => new Set());
  const [phase, setPhase] = useState<"active" | "success">("active");

  const remaining = useMemo(
    () => queue.filter((message) => !processedIds.has(message.id)),
    [queue, processedIds],
  );

  const total = queue.length;
  const completed = processedIds.size;
  const current = remaining[0];

  const advance = useCallback(
    (id: string) => {
      setProcessedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        if (next.size >= queue.length) {
          window.setTimeout(() => setPhase("success"), 200);
        }
        return next;
      });
    },
    [queue.length],
  );

  if (phase === "success" || !current) {
    return (
      <FirstTimeSuccessScreen
        locale={locale}
        onGoToInbox={() => onFinished("inbox")}
        onStayInFocus={() => onFinished("focus")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm tabular-nums text-gray-500">{t.progress(completed, total)}</p>

      <OnboardingEmailCard
        key={current.id}
        message={current}
        locale={locale}
        readStateMap={readStateMap}
        onAdvance={() => advance(current.id)}
      />
    </div>
  );
}

export type OnboardingEmailCardHandle = {
  triggerReply: () => void;
  triggerDone: () => void;
  busy: boolean;
};

export const OnboardingEmailCard = forwardRef<
  OnboardingEmailCardHandle,
  {
    message: GmailCardMessage;
    locale: "en" | "it";
    readStateMap: ReadStateMap;
    onAdvance: () => void;
    hidePrimaryActions?: boolean;
    /** Background-load detail so reply is ready — no UI interruption. */
    presencePrefetch?: boolean;
  }
>(function OnboardingEmailCard(
  { message, locale, readStateMap, onAdvance, hidePrimaryActions = false, presencePrefetch = false },
  ref,
) {
  const t = COPY[locale];
  const [expanded, setExpanded] = useState(false);
  const [showReply, setShowReply] = useState(false);

  const detailEnabled = expanded || showReply || presencePrefetch;
  const { state: detailState, reload } = useGmailEmailDetail(
    message.id,
    message.accountId,
    detailEnabled,
  );

  const detailEmail = detailState.status === "ready" ? detailState.email : null;
  const smartReplyContent =
    detailEmail?.replyContext ??
    detailEmail?.bodyPlain ??
    detailEmail?.body ??
    `${message.subject}\n\n${message.snippet}`;

  const detailHref = (() => {
    const base = `/emails/${encodeURIComponent(message.id)}`;
    return message.accountId ? `${base}?accountId=${encodeURIComponent(message.accountId)}` : base;
  })();

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
    void emailStatus.handleComplete("took_action", label);
  }, [emailStatus, locale]);

  const triggerReply = useCallback(() => {
    setShowReply(true);
    markEmailsRead([message.id], { accountId: message.accountId });
  }, [message.id, message.accountId]);

  useImperativeHandle(
    ref,
    () => ({
      triggerReply,
      triggerDone: handleDone,
      busy: emailStatus.busy,
    }),
    [triggerReply, handleDone, emailStatus.busy],
  );

  const handleMarkReplied = useCallback(() => {
    const label = locale === "it" ? "Risposto" : "Replied";
    void emailStatus.handleComplete("replied", label);
    setShowReply(false);
  }, [emailStatus, locale]);

  const openFullEmail = useCallback(() => {
    setExpanded(true);
    markEmailsRead([message.id], { accountId: message.accountId });
  }, [message.id, message.accountId]);

  if (expanded) {
    return (
      <article className="rounded-2xl border border-gray-100 border-l-4 border-l-[#9733ff] bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-sm font-medium text-accent transition hover:text-accent-hover"
          >
            ← {t.back}
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-gray-900">{message.sender}</p>
          <h2 className="mt-1 text-lg font-medium leading-snug text-gray-900">
            {message.subject || "(no subject)"}
          </h2>

          {detailState.status === "loading" ? (
            <div className="mt-6 flex items-center gap-3 py-8">
              <CalmTypingIndicator />
            </div>
          ) : detailState.status === "error" ? (
            <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{detailState.message || t.loadError}</p>
              <button type="button" onClick={reload} className="mt-2 font-medium underline">
                {t.retry}
              </button>
            </div>
          ) : detailEmail ? (
            <article className="mt-5">
              <EmailBody
                variant="minimal"
                bodyHtml={detailEmail.bodyHtml}
                bodyPlain={detailEmail.bodyPlain ?? detailEmail.body}
              />
              <div className="mt-6 border-t border-gray-100 pt-4">
                <EmailActions
                  calmLayout
                  alwaysOfferReply
                  anticipatoryPrefetch
                  embedInFlow
                  onReplySent={onAdvance}
                  accountId={message.accountId}
                  emailId={detailEmail.id}
                  emailContent={detailEmail.replyContext ?? detailEmail.body}
                  senderName={detailEmail.sender}
                  subject={detailEmail.subject}
                  snippet={detailEmail.summary}
                  suggestedReply={detailEmail.suggestedReply}
                  inboxCategory={detailEmail.inboxCategory ?? message.category}
                  replyRecommended={detailEmail.replyRecommended ?? true}
                  replySuppressedReason={detailEmail.replySuppressedReason}
                  suggestedTriageAction={detailEmail.suggestedTriageAction}
                  followUpAnalysis={detailEmail.followUpAnalysis}
                  relationship={detailEmail.relationship}
                />
              </div>
            </article>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            {!hidePrimaryActions ? (
              <>
                <PrimaryAction onClick={triggerReply} label={t.reply} />
                <SecondaryAction onClick={handleDone} label={t.done} busy={emailStatus.busy} />
              </>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-gray-100 border-l-4 border-l-[#9733ff] bg-white px-5 py-6 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">{message.sender}</p>
      <h2 className="mt-1 text-lg font-medium leading-snug text-gray-900">
        {message.subject || "(no subject)"}
      </h2>
      {message.snippet ? (
        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-gray-500">{message.snippet}</p>
      ) : null}

      {!hidePrimaryActions ? (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <PrimaryAction onClick={triggerReply} label={t.reply} />
          <SecondaryAction onClick={handleDone} label={t.done} busy={emailStatus.busy} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={openFullEmail}
        className="mt-3 text-sm font-medium text-gray-500 transition hover:text-accent"
      >
        {t.viewFull}
      </button>

      {showReply ? (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <SmartReplyPanel
            emailId={message.id}
            accountId={message.accountId}
            sender={message.sender}
            subject={message.subject}
            snippet={message.snippet}
            emailContent={smartReplyContent}
            category={message.category}
            locale={locale}
            detailHref={detailHref}
            forceOffer
            onDismiss={() => setShowReply(false)}
            onMarkReplied={handleMarkReplied}
          />
        </div>
      ) : null}
    </article>
  );
});

function PrimaryAction({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex flex-1 items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
    >
      {label}
    </button>
  );
}

function SecondaryAction({
  onClick,
  label,
  busy,
}: {
  onClick: () => void;
  label: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-accent/30 hover:text-accent disabled:opacity-60"
    >
      {label}
    </button>
  );
}
