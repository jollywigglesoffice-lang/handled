"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CategoryCorrectionPanel } from "@/app/emails/category-correction-panel";
import { DoneWithThisPicker } from "@/app/emails/done-with-this-picker";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { EmailActions } from "@/app/emails/[id]/email-actions";
import { EmailBody } from "@/app/emails/[id]/email-body";
import { useEmailStatusActions } from "@/app/emails/use-email-status-actions";
import { useGmailEmailDetail } from "@/app/emails/use-gmail-email-detail";
import { CalmTypingIndicator } from "@/app/components/calm-loading";
import { SmartReplyPanel } from "@/app/emails/smart-reply-panel";
import { logAssistedConfirmation } from "@/lib/autopilot/execute";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { inboxCategorySectionTitle, type InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import { EmailSchedulePanel } from "@/app/components/email-schedule-panel";
import { markEmailsRead } from "@/lib/read-state/gmail-sync";
import { handledActionCopy } from "@/lib/handled-action-copy";

type PanelMode = "compact" | "expanded";

type InboxZeroEmailPanelProps = {
  message: GmailCardMessage;
  locale: "en" | "it";
  readStateMap: ReadStateMap;
  onAdvance: () => void;
  onArchive: (message: GmailCardMessage) => void;
  onCategoryChange: (
    id: string,
    category: InboxAiCategory,
    options?: InboxCategoryChangeOptions,
  ) => void;
};

const COPY = {
  en: {
    reply: handledActionCopy("en").reply,
    done: handledActionCopy("en").handled,
    archive: handledActionCopy("en").putAway,
    expand: "Expand",
    next: "Next",
    backToFlow: "Back to flow",
    changeCategory: handledActionCopy("en").moveTo,
    fullEmail: "Full email",
    draftReply: "Draft reply",
    loadError: "Could not load full email.",
    retry: "Try again",
    donePrompt: handledActionCopy("en").handledPrompt,
  },
  it: {
    reply: handledActionCopy("it").reply,
    done: handledActionCopy("it").handled,
    archive: handledActionCopy("it").putAway,
    expand: "Espandi",
    next: "Avanti",
    backToFlow: "Torna al flusso",
    changeCategory: handledActionCopy("it").moveTo,
    fullEmail: "Email completa",
    draftReply: "Bozza di risposta",
    loadError: "Impossibile caricare l'email.",
    retry: "Riprova",
    donePrompt: handledActionCopy("it").handledPrompt,
  },
} as const;

export function InboxZeroEmailPanel({
  message,
  locale,
  readStateMap,
  onAdvance,
  onArchive,
  onCategoryChange,
}: InboxZeroEmailPanelProps) {
  const t = COPY[locale];
  const [mode, setMode] = useState<PanelMode>("compact");
  const [showSmartReply, setShowSmartReply] = useState(false);
  const [showDonePicker, setShowDonePicker] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<string | null>(null);
  const replySectionRef = useRef<HTMLDivElement>(null);

  const showScheduling = message.calendarIntentLevel === "SCHEDULE_REQUIRED";

  const detailEnabled = mode === "expanded" || showSmartReply;
  const { state: detailState, reload } = useGmailEmailDetail(
    message.id,
    message.accountId,
    detailEnabled,
  );

  useEffect(() => {
    setMode("compact");
    setShowSmartReply(false);
    setShowDonePicker(false);
    setShowCategory(false);
  }, [message.id]);

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
      setShowDonePicker(false);
      onAdvance();
    },
  });

  const handleMarkReplied = useCallback(() => {
    const label = locale === "it" ? "Risposto" : "Replied";
    void emailStatus.handleComplete("replied", label);
    setShowSmartReply(false);
  }, [emailStatus, locale]);

  const openExpanded = useCallback(
    (focusReply = false) => {
      setMode("expanded");
      markEmailsRead([message.id], { accountId: message.accountId });
      if (focusReply) {
        window.setTimeout(() => {
          replySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 400);
      }
    },
    [message.id, message.accountId],
  );

  const handleArchive = useCallback(() => {
    onArchive(message);
    onAdvance();
  }, [message, onArchive, onAdvance]);

  const handleCategoryApply = useCallback(
    async (chosen: InboxAiCategory, scope: CategoryApplyScope) => {
      const options: InboxCategoryChangeOptions = {
        scope,
        guessedCategory: message.category,
        ...(scope === "sender" ? { sender: message.sender } : {}),
      };
      onCategoryChange(message.id, chosen, options);
      setShowCategory(false);
      onAdvance();
    },
    [message, onCategoryChange, onAdvance],
  );

  const handleReplySent = useCallback(() => {
    setMode("compact");
    onAdvance();
  }, [onAdvance]);

  if (mode === "expanded") {
    return (
      <article className="rounded-2xl border border-gray-100 border-l-4 border-l-[#9733ff] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setMode("compact")}
            className="text-sm font-medium text-accent transition hover:text-accent-hover"
          >
            ← {t.backToFlow}
          </button>
          <FlowActions
            doneLabel={t.done}
            archiveLabel={t.archive}
            nextLabel={t.next}
            onDone={() => setShowDonePicker(true)}
            onArchive={handleArchive}
            onNext={onAdvance}
            busy={emailStatus.busy}
          />
        </div>

        <div className="px-5 py-5">
          <span className="inline-flex rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
            {inboxCategorySectionTitle(message.category, locale)}
          </span>

          <p className="mt-4 text-sm font-semibold text-gray-900">{message.sender}</p>
          <h2 className="mt-1 text-lg font-medium leading-snug text-gray-900">
            {message.subject || "(no subject)"}
          </h2>

          {detailState.status === "loading" ? (
            <div className="mt-6 flex items-center gap-3 py-8">
              <CalmTypingIndicator />
              <span className="text-sm text-gray-400">
                {locale === "it" ? "Caricamento…" : "Loading…"}
              </span>
            </div>
          ) : detailState.status === "error" ? (
            <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{detailState.message || t.loadError}</p>
              <button type="button" onClick={reload} className="mt-2 font-medium underline">
                {t.retry}
              </button>
            </div>
          ) : detailEmail ? (
            <>
              <article className="mt-5">
                <h3 className="mb-2 text-xs font-medium text-gray-400">{t.fullEmail}</h3>
                <EmailBody
                  variant="minimal"
                  bodyHtml={detailEmail.bodyHtml}
                  bodyPlain={detailEmail.bodyPlain ?? detailEmail.body}
                />
              </article>

              {showScheduling ? (
                <EmailSchedulePanel
                  embedded
                  emailId={message.id}
                  sender={message.sender}
                  subject={message.subject}
                  locale={locale}
                  accountId={message.accountId}
                  detailHref={detailHref}
                  onDraftReply={(text) => setScheduleDraft(text)}
                />
              ) : null}

              <section ref={replySectionRef} className="mt-6">
                <h3 className="mb-3 text-xs font-medium text-gray-400">{t.draftReply}</h3>
                <SmartReplyPanel
                  emailId={message.id}
                  accountId={message.accountId}
                  sender={message.sender}
                  subject={message.subject}
                  snippet={message.snippet}
                  emailContent={
                    detailEmail.replyContext ??
                    detailEmail.bodyPlain ??
                    detailEmail.body ??
                    smartReplyContent
                  }
                  category={detailEmail.inboxCategory ?? message.category}
                  locale={locale}
                  detailHref={detailHref}
                  forceOffer
                  initialDraft={scheduleDraft ?? undefined}
                  onDismiss={() => setMode("compact")}
                  onMarkReplied={handleMarkReplied}
                />
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <EmailActions
                  calmLayout
                  alwaysOfferReply
                  anticipatoryPrefetch
                  embedInFlow
                  onReplySent={handleReplySent}
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
              </section>
            </>
          ) : null}

          {showDonePicker ? (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-medium text-gray-500">{t.donePrompt}</p>
              <DoneWithThisPicker
                locale={locale}
                busy={emailStatus.busy}
                onSelect={(id, label, extras) => void emailStatus.handleComplete(id, label, extras)}
              />
              <button
                type="button"
                onClick={() => setShowDonePicker(false)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600"
              >
                {locale === "it" ? "Annulla" : "Cancel"}
              </button>
            </div>
          ) : null}

          {showCategory ? (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <CategoryCorrectionPanel
                compact
                scopeMode="this_or_sender"
                target={{
                  id: message.id,
                  sender: message.sender,
                  subject: message.subject,
                  snippet: message.snippet,
                  guessedCategory: message.category,
                }}
                onApply={(chosen, scope) => void handleCategoryApply(chosen, scope)}
                onDismiss={() => setShowCategory(false)}
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setShowCategory(true)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-accent/30 hover:text-accent"
            >
              {t.changeCategory}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-gray-100 border-l-4 border-l-[#9733ff] bg-white px-5 py-6 shadow-sm">
      <span className="inline-flex rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
        {inboxCategorySectionTitle(message.category, locale)}
      </span>

      <p className="mt-4 text-sm font-semibold text-gray-900">{message.sender}</p>
      <h2 className="mt-1 text-lg font-medium leading-snug text-gray-900">
        {message.subject || "(no subject)"}
      </h2>
      {message.snippet ? (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-500">{message.snippet}</p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ActionButton onClick={() => openExpanded(false)} label={t.expand} />
        <ActionButton
          primary
          onClick={() => {
            setShowSmartReply(true);
            markEmailsRead([message.id], { accountId: message.accountId });
          }}
          label={t.reply}
        />
        <ActionButton onClick={() => setShowDonePicker(true)} label={t.done} />
        <ActionButton onClick={onAdvance} label={t.next} muted />
      </div>

      {showSmartReply ? (
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
          onDismiss={() => setShowSmartReply(false)}
          onMarkReplied={handleMarkReplied}
        />
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleArchive}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-accent/30 hover:text-accent"
        >
          {t.archive}
        </button>
        <button
          type="button"
          onClick={() => setShowCategory(true)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-accent/30 hover:text-accent"
        >
          {t.changeCategory}
        </button>
      </div>

      {showDonePicker ? (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-medium text-gray-500">{t.donePrompt}</p>
          <DoneWithThisPicker
            locale={locale}
            busy={emailStatus.busy}
            onSelect={(id, label, extras) => void emailStatus.handleComplete(id, label, extras)}
          />
          <button
            type="button"
            onClick={() => setShowDonePicker(false)}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600"
          >
            {locale === "it" ? "Annulla" : "Cancel"}
          </button>
        </div>
      ) : null}

      {showCategory ? (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <CategoryCorrectionPanel
            compact
            scopeMode="this_or_sender"
            target={{
              id: message.id,
              sender: message.sender,
              subject: message.subject,
              snippet: message.snippet,
              guessedCategory: message.category,
            }}
            onApply={(chosen, scope) => void handleCategoryApply(chosen, scope)}
            onDismiss={() => setShowCategory(false)}
          />
        </div>
      ) : null}
    </article>
  );
}

function FlowActions({
  doneLabel,
  archiveLabel,
  nextLabel,
  onDone,
  onArchive,
  onNext,
  busy,
}: {
  doneLabel: string;
  archiveLabel: string;
  nextLabel: string;
  onDone: () => void;
  onArchive: () => void;
  onNext: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ActionButton small onClick={onDone} label={doneLabel} disabled={busy} />
      <ActionButton small onClick={onArchive} label={archiveLabel} disabled={busy} />
      <ActionButton small onClick={onNext} label={nextLabel} muted disabled={busy} />
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary = false,
  muted = false,
  small = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const size = small ? "px-2.5 py-1 text-xs" : "px-3 py-2.5 text-sm";
  const styles = primary
    ? "bg-accent text-white hover:bg-accent-hover"
    : muted
      ? "border border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600"
      : "border border-gray-200 bg-white text-gray-700 hover:border-accent/30 hover:text-accent";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl font-semibold transition disabled:opacity-60 ${size} ${styles}`}
    >
      {label}
    </button>
  );
}
