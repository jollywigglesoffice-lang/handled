"use client";

import { useState } from "react";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { CompleteEmailExtras } from "@/lib/email-completions/types";
import { WaitingOnDetailsPanel } from "@/app/emails/waiting-on-details-panel";
import { handledActionCopy } from "@/lib/handled-action-copy";

type EmailIntentActionsProps = {
  locale: "en" | "it";
  busy?: boolean;
  onSelect: (
    actionId: CompletionActionId,
    actionLabel: string,
    extras?: CompleteEmailExtras,
  ) => void;
};

/** Gentle intent shortcuts on email detail — workflow, not categories. */
export function EmailIntentActions({ locale, busy, onSelect }: EmailIntentActionsProps) {
  const t = handledActionCopy(locale);
  const [showWaitingDetails, setShowWaitingDetails] = useState(false);

  if (showWaitingDetails) {
    return (
      <div className="rounded-xl border border-indigo-100/80 bg-indigo-50/20 p-3">
        <WaitingOnDetailsPanel
          locale={locale}
          busy={busy}
          onBack={() => setShowWaitingDetails(false)}
          onConfirm={(extras) => {
            onSelect("waiting_on_someone", t.waitingOnSomeone, extras);
            setShowWaitingDetails(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-[#FAFBFC] px-3 py-3">
      <p className="text-xs text-gray-400">{t.handledPrompt}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <IntentChip
          disabled={busy}
          onClick={() => onSelect("saved_for_reference", t.replyLater)}
        >
          {t.replyLater}
        </IntentChip>
        <IntentChip disabled={busy} onClick={() => setShowWaitingDetails(true)}>
          {t.waitingOnSomeone}
        </IntentChip>
        <IntentChip
          disabled={busy}
          onClick={() => onSelect("no_action_needed", t.noActionNeeded)}
        >
          {t.noActionNeeded}
        </IntentChip>
      </div>
    </div>
  );
}

function IntentChip({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-accent/25 hover:bg-accent-muted/20 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
