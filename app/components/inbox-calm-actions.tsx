"use client";

import Link from "next/link";
import { useState } from "react";
import { DoneWithThisPicker } from "@/app/emails/done-with-this-picker";
import type { EmailStatusActionState } from "@/app/components/email-card-integrated-controls";
import {
  inboxPrimaryActionLabel,
  type InboxPrimaryActionKind,
} from "@/lib/inbox-emotional-state";
import { handledActionCopy } from "@/lib/handled-action-copy";
import { completionLabelForActionState } from "@/lib/email-action-state-copy";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { EmailActionState } from "@/lib/action-intelligence";

type InboxCalmActionsProps = {
  status: EmailStatusActionState;
  locale: "en" | "it";
  primaryAction: InboxPrimaryActionKind;
  detailHref: string;
  hideActions?: boolean;
  category?: InboxAiCategory;
  categoryConfidence?: number;
  actionable?: boolean;
  actionState?: EmailActionState;
  onChangeCategory: () => void;
  onSetRelationship: () => void;
  changeCategoryLabel?: string;
  setRelationshipLabel: string;
  onResetOverride?: () => void;
  showResetOverride?: boolean;
  onSmartReply?: () => void;
  onSchedule?: () => void;
};

/**
 * Notion-style command row — one calm surface, no competing controls.
 */
export function InboxCalmActions({
  status,
  locale,
  primaryAction,
  detailHref,
  hideActions,
  category,
  categoryConfidence,
  actionable,
  actionState,
  onChangeCategory,
  onSetRelationship,
  changeCategoryLabel,
  setRelationshipLabel,
  onResetOverride,
  showResetOverride,
  onSmartReply,
  onSchedule,
}: InboxCalmActionsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const {
    t,
    lifecycle,
    completed,
    completion,
    showDonePicker,
    setShowDonePicker,
    busy,
    feedback,
    handleMarkRead,
    handleMarkUnread,
    handleComplete,
    handleUndo,
  } = status;

  const actions = handledActionCopy(locale);

  if (hideActions) return null;

  const primaryLabel = inboxPrimaryActionLabel(primaryAction, locale);
  const moreLabel = locale === "it" ? "Altro" : "More";
  const delegateLabel = locale === "it" ? "Delega" : "Delegate";
  const scheduleLabel = locale === "it" ? "Programma" : "Schedule";

  async function handleIgnore() {
    if (busy) return;
    const label = completionLabelForActionState(
      "no_action_needed",
      actions.noActionNeeded,
      locale,
      actionState ?? "passive",
    );
    await handleComplete("no_action_needed", label);
  }

  if (completed) {
    return (
      <div className="space-y-1.5 pt-3">
        <p className="text-xs text-gray-400">
          {completion ? t.completedAs(completion.actionLabel) : t.doneWith}
          {" · "}
          <button
            type="button"
            onClick={() => void handleUndo()}
            disabled={busy}
            className="font-medium text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-40"
          >
            {t.undo}
          </button>
        </p>
        {feedback ? <p className="text-xs text-emerald-700/80">{feedback}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-4">
      <div className="flex flex-wrap items-center gap-0.5">
        {primaryAction === "ignore" ? (
          <CommandButton disabled={busy} onClick={() => void handleIgnore()}>
            {primaryLabel}
          </CommandButton>
        ) : primaryAction === "schedule" ? (
          <CommandButton primary disabled={busy} onClick={onSchedule}>
            {primaryLabel}
          </CommandButton>
        ) : primaryAction === "reply" ? (
          onSmartReply ? (
            <CommandButton primary disabled={busy} onClick={onSmartReply}>
              {primaryLabel}
            </CommandButton>
          ) : (
            <CommandButton primary asLink href={detailHref} disabled={busy}>
              {primaryLabel}
            </CommandButton>
          )
        ) : (
          <CommandButton primary asLink href={detailHref} disabled={busy}>
            {primaryLabel}
          </CommandButton>
        )}

        <CommandButton
          disabled={busy}
          onClick={() => {
            setShowDonePicker((v) => !v);
            setMoreOpen(false);
          }}
        >
          {actions.handled}
        </CommandButton>

        <CommandButton
          disabled={busy}
          onClick={() =>
            void handleComplete("saved_for_reference", actions.putAway)
          }
        >
          {actions.putAway}
        </CommandButton>

        <CommandButton disabled title={locale === "it" ? "Prossimamente" : "Coming soon"}>
          {delegateLabel}
        </CommandButton>

        <CommandButton
          disabled={busy}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
        >
          {moreLabel}
        </CommandButton>
      </div>

      {moreOpen ? (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-gray-400">
          <MoreLink onClick={onChangeCategory} disabled={busy}>
            {changeCategoryLabel ?? t.changeCategory}
          </MoreLink>
          <Sep />
          <MoreLink onClick={onSetRelationship} disabled={busy}>
            {setRelationshipLabel}
          </MoreLink>
          <Sep />
          {lifecycle === "unread" ? (
            <MoreLink onClick={handleMarkRead} disabled={busy}>
              {t.markRead}
            </MoreLink>
          ) : (
            <MoreLink onClick={handleMarkUnread} disabled={busy}>
              {t.markUnread}
            </MoreLink>
          )}
          {showResetOverride && onResetOverride ? (
            <>
              <Sep />
              <MoreLink onClick={onResetOverride} disabled={busy}>
                {locale === "it" ? "Ripristina categoria AI" : "Reset to AI categorization"}
              </MoreLink>
            </>
          ) : null}
        </div>
      ) : null}

      {showDonePicker ? (
        <div className="pt-2">
          <DoneWithThisPicker
            locale={locale}
            busy={busy}
            onSelect={(id, label, extras) => void handleComplete(id, label, extras)}
          />
          <button
            type="button"
            onClick={() => setShowDonePicker(false)}
            className="mt-1.5 text-xs text-gray-300 hover:text-gray-500"
          >
            {actions.cancel}
          </button>
        </div>
      ) : null}

      {feedback ? <p className="text-xs text-emerald-700/80">{feedback}</p> : null}
    </div>
  );
}

function CommandButton({
  children,
  onClick,
  disabled,
  primary,
  asLink,
  href,
  title,
  "aria-expanded": ariaExpanded,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  asLink?: boolean;
  href?: string;
  title?: string;
  "aria-expanded"?: boolean;
}) {
  const className = `rounded-md px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
    primary
      ? "bg-gray-900 text-white hover:bg-gray-800"
      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
  }`;

  if (asLink && href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-expanded={ariaExpanded}
      className={className}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="text-gray-200" aria-hidden>·</span>;
}

function MoreLink({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="font-medium transition hover:text-gray-600 hover:underline disabled:opacity-40"
    >
      {children}
    </button>
  );
}
