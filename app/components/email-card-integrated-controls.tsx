"use client";

import { EmailLifecycleIndicator } from "@/app/components/email-lifecycle-indicator";
import { CompletionActionPicker } from "@/app/emails/completion-action-picker";
import type { useEmailStatusActions } from "@/app/emails/use-email-status-actions";
import type { EmailLifecycleState } from "@/lib/email-lifecycle";

export type EmailStatusActionState = ReturnType<typeof useEmailStatusActions>;

/** Symbol-only read state for the card header row */
export function EmailReadStateDot({
  lifecycle,
  locale,
}: {
  lifecycle: EmailLifecycleState;
  locale: "en" | "it";
}) {
  return <EmailLifecycleIndicator state={lifecycle} locale={locale} symbolOnly />;
}

type EmailCardActionRowProps = {
  status: EmailStatusActionState;
  locale: "en" | "it";
  onChangeCategory: () => void;
  onSetRelationship: () => void;
  changeCategoryLabel?: string;
  setRelationshipLabel: string;
  hideActions?: boolean;
};

/** Bottom row: Change category · Set relationship · Mark read/unread · Done with this */
export function EmailCardActionRow({
  status,
  locale,
  onChangeCategory,
  onSetRelationship,
  changeCategoryLabel,
  setRelationshipLabel,
  hideActions = false,
}: EmailCardActionRowProps) {
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

  if (hideActions) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
        {!completed ? (
          <>
            <ActionLink onClick={onChangeCategory}>
              {changeCategoryLabel ?? t.changeCategory}
            </ActionLink>
            <Sep />
            <ActionLink onClick={onSetRelationship}>{setRelationshipLabel}</ActionLink>
            <Sep />
            {lifecycle === "unread" ? (
              <ActionLink onClick={handleMarkRead} disabled={busy}>
                {t.markRead}
              </ActionLink>
            ) : (
              <ActionLink onClick={handleMarkUnread} disabled={busy}>
                {t.markUnread}
              </ActionLink>
            )}
            <Sep />
            <ActionLink
              onClick={() => setShowDonePicker((v) => !v)}
              disabled={busy}
              emphasis
            >
              ✓ {t.doneWith}
            </ActionLink>
          </>
        ) : (
          <>
            <span className="font-medium text-emerald-800">
              {completion ? t.completedAs(completion.actionLabel) : t.doneWith}
            </span>
            <Sep />
            <ActionLink onClick={() => void handleUndo()} disabled={busy}>
              {t.undo}
            </ActionLink>
          </>
        )}
      </div>

      {showDonePicker && !completed ? (
        <div className="border-t border-emerald-100 pt-2">
          <CompletionActionPicker
            locale={locale}
            compact
            busy={busy}
            onSelect={(id, label) => void handleComplete(id, label)}
          />
          <button
            type="button"
            onClick={() => setShowDonePicker(false)}
            className="mt-1.5 text-xs text-gray-400 hover:text-gray-600"
          >
            {locale === "it" ? "Annulla" : "Cancel"}
          </button>
        </div>
      ) : null}

      {feedback ? (
        <p className="text-xs text-emerald-700">
          {feedback}
          {completed ? (
            <>
              {" "}
              <button
                type="button"
                onClick={() => void handleUndo()}
                className="underline hover:text-emerald-900"
              >
                {t.undo}
              </button>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function Sep() {
  return <span className="text-gray-300" aria-hidden>·</span>;
}

function ActionLink({
  children,
  onClick,
  disabled,
  emphasis,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`font-medium transition hover:underline disabled:opacity-40 ${
        emphasis ? "text-emerald-700 hover:text-emerald-800" : "text-accent hover:text-accent-hover"
      }`}
    >
      {children}
    </button>
  );
}
