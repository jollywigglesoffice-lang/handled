"use client";

import { CompletionActionPicker } from "@/app/emails/completion-action-picker";
import { CompletionSuggestion } from "@/app/emails/completion-suggestion";
import { useEmailStatusActions, type EmailStatusActionsInput } from "@/app/emails/use-email-status-actions";
import { EmailLifecycleIndicator } from "@/app/components/email-lifecycle-indicator";

export type EmailStatusBarProps = EmailStatusActionsInput & {
  /** detail = prominent header on email page; integrated = use EmailCardActionRow instead */
  variant?: "detail" | "integrated";
};

/** Standalone bar for email detail page header */
export function EmailStatusBar({
  variant = "detail",
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
              <span className="text-gray-300">·</span>
              <DetailLink
                emphasis
                onClick={() => setShowDonePicker((v) => !v)}
                disabled={busy}
              >
                ✓ {t.doneWith}
              </DetailLink>
            </>
          ) : isActiveWaitingItem ? (
            <>
              <span className="text-sm font-medium text-amber-800">
                {completion?.actionLabel ?? t.doneWith}
              </span>
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
              <span className="text-gray-300">·</span>
              <DetailLink onClick={() => void handleUndo()} disabled={busy}>
                {t.undo}
              </DetailLink>
            </>
          )}
        </div>
      </div>

      {!completed ? (
        <CompletionSuggestion
          emailId={props.emailId}
          sender={props.sender}
          subject={props.subject}
          category={props.category}
          locale={props.locale}
          busy={busy}
          onSelect={(id, label, extras) => void handleComplete(id, label, extras)}
        />
      ) : null}

      {showDonePicker && !completed ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
          <CompletionActionPicker
            locale={props.locale}
            compact
            busy={busy}
            onSelect={(id, label, extras) => void handleComplete(id, label, extras)}
          />
          <button
            type="button"
            onClick={() => setShowDonePicker(false)}
            className="mt-2 text-xs text-gray-500 underline"
          >
            {props.locale === "it" ? "Annulla" : "Cancel"}
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
