"use client";

import { DoneWithThisPicker } from "@/app/emails/done-with-this-picker";
import { EmailIntentActions } from "@/app/emails/email-intent-actions";
import { CompletionSuggestion } from "@/app/emails/completion-suggestion";
import { useEmailStatusActions, type EmailStatusActionsInput } from "@/app/emails/use-email-status-actions";
import { EmailLifecycleIndicator } from "@/app/components/email-lifecycle-indicator";
import { handledActionCopy } from "@/lib/handled-action-copy";

export type EmailStatusBarProps = EmailStatusActionsInput & {
  /** detail = prominent header on email page; integrated = use EmailCardActionRow instead */
  variant?: "detail" | "integrated";
  categoryConfidence?: number;
  actionable?: boolean;
  actionState?: import("@/lib/action-intelligence").EmailActionState;
  /** Show every completion action in the done picker (detail default). */
  showAllCompletionActions?: boolean;
  /** Gmail compose URL for forwarding */
  forwardHref?: string;
  onOpenChangeCategory?: () => void;
};

/** Standalone bar for email detail page header */
export function EmailStatusBar({
  variant = "detail",
  categoryConfidence,
  actionable,
  actionState,
  showAllCompletionActions,
  forwardHref,
  onOpenChangeCategory,
  ...props
}: EmailStatusBarProps) {
  if (variant === "integrated") return null;

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
    isActiveWaitingItem,
    handleResolveWaiting,
  } = useEmailStatusActions(props);
  const actions = handledActionCopy(props.locale);

  return (
    <div className="space-y-2" data-testid="email-status-bar">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 shadow-sm">
        <EmailLifecycleIndicator state={lifecycle} locale={props.locale} />

        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          {!completed ? (
            <>
              <DetailLink onClick={handleMarkRead} disabled={busy || lifecycle === "read"}>
                {t.markRead}
              </DetailLink>
              <span className="text-gray-300">·</span>
              <DetailLink onClick={handleMarkUnread} disabled={busy || lifecycle === "unread"}>
                {t.markUnread}
              </DetailLink>
              {onOpenChangeCategory ? (
                <>
                  <span className="text-gray-300">·</span>
                  <DetailLink onClick={onOpenChangeCategory} disabled={busy}>
                    {t.changeCategory}
                  </DetailLink>
                </>
              ) : null}
              {forwardHref ? (
                <>
                  <span className="text-gray-300">·</span>
                  <a
                    href={forwardHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0F172A] transition hover:underline"
                  >
                    {actions.forward}
                  </a>
                </>
              ) : null}
              <span className="text-gray-300">·</span>
              <DetailLink
                emphasis
                onClick={() => setShowDonePicker((v) => !v)}
                disabled={busy}
              >
                {t.doneWith}
              </DetailLink>
            </>
          ) : isActiveWaitingItem ? (
            <>
              <span className="text-sm font-medium text-amber-800">
                {completion?.actionLabel ?? t.doneWith}
              </span>
              {onOpenChangeCategory ? (
                <>
                  <span className="text-gray-300">·</span>
                  <DetailLink onClick={onOpenChangeCategory} disabled={busy}>
                    {t.changeCategory}
                  </DetailLink>
                </>
              ) : null}
              {forwardHref ? (
                <>
                  <span className="text-gray-300">·</span>
                  <a
                    href={forwardHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0F172A] transition hover:underline"
                  >
                    {actions.forward}
                  </a>
                </>
              ) : null}
              <span className="text-gray-300">·</span>
              <DetailLink
                emphasis
                onClick={() => void handleResolveWaiting("received_response")}
                disabled={busy}
              >
                {props.locale === "it" ? "✓ Risposta ricevuta" : "✓ Received response"}
              </DetailLink>
              <span className="text-gray-300">·</span>
              <DetailLink
                onClick={() => void handleResolveWaiting("no_longer_waiting")}
                disabled={busy}
              >
                {props.locale === "it" ? "✓ Non più in attesa" : "✓ No longer waiting"}
              </DetailLink>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-emerald-800">
                {completion ? t.completedAs(completion.actionLabel) : t.doneWith}
              </span>
              {onOpenChangeCategory ? (
                <>
                  <span className="text-gray-300">·</span>
                  <DetailLink onClick={onOpenChangeCategory} disabled={busy}>
                    {t.changeCategory}
                  </DetailLink>
                </>
              ) : null}
              {forwardHref ? (
                <>
                  <span className="text-gray-300">·</span>
                  <a
                    href={forwardHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0F172A] transition hover:underline"
                  >
                    {actions.forward}
                  </a>
                </>
              ) : null}
              <span className="text-gray-300">·</span>
              <DetailLink onClick={() => void handleUndo()} disabled={busy}>
                {t.undo}
              </DetailLink>
            </>
          )}
        </div>
      </div>

      {!completed ? (
        <EmailIntentActions
          locale={props.locale}
          busy={busy}
          onSelect={(id, label, extras) => void handleComplete(id, label, extras)}
        />
      ) : null}

      {!completed ? (
        <CompletionSuggestion
          emailId={props.emailId}
          sender={props.sender}
          subject={props.subject}
          category={props.category}
          locale={props.locale}
          busy={busy}
          categoryConfidence={categoryConfidence}
          actionable={actionable}
          actionState={actionState}
          onSelect={(id, label, extras) => void handleComplete(id, label, extras)}
        />
      ) : null}

      {showDonePicker && !completed ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
          <DoneWithThisPicker
            locale={props.locale}
            busy={busy}
            onSelect={(id, label, extras) => void handleComplete(id, label, extras)}
          />
          <button
            type="button"
            onClick={() => setShowDonePicker(false)}
            className="mt-2 text-xs text-gray-500 underline"
          >
            {actions.cancel}
          </button>
        </div>
      ) : null}

      {feedback ? (
        <p className="text-xs font-medium text-emerald-700">
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

function DetailLink({
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
      className={`font-semibold transition hover:underline disabled:opacity-40 ${
        emphasis ? "text-emerald-700" : "text-[#0F172A]"
      }`}
    >
      {children}
    </button>
  );
}
