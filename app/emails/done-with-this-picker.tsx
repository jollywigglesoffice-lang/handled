"use client";

import { useState } from "react";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { CompleteEmailExtras } from "@/lib/email-completions/types";
import { WaitingOnDetailsPanel } from "@/app/emails/waiting-on-details-panel";
import { handledActionCopy } from "@/lib/handled-action-copy";

type DoneWithThisPickerProps = {
  locale: "en" | "it";
  busy?: boolean;
  onSelect: (
    actionId: CompletionActionId,
    actionLabel: string,
    extras?: CompleteEmailExtras,
  ) => void;
};

/** Simplified handled flow — workflow states, not categories. */
export function DoneWithThisPicker({ locale, busy, onSelect }: DoneWithThisPickerProps) {
  const t = handledActionCopy(locale);
  const [showWaitingDetails, setShowWaitingDetails] = useState(false);

  if (showWaitingDetails) {
    return (
      <div className="mt-3">
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
    <div className="mt-3">
      <p className="text-sm font-medium text-[#0F172A]">{t.handledPrompt}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <DoneOption
          label={t.putAway}
          disabled={busy}
          onClick={() => onSelect("saved_for_reference", t.putAway)}
        />
        <DoneOption
          label={t.noActionNeeded}
          disabled={busy}
          onClick={() => onSelect("no_action_needed", t.noActionNeeded)}
        />
        <DoneOption
          label={t.waitingOnSomeone}
          disabled={busy}
          onClick={() => setShowWaitingDetails(true)}
        />
      </div>
    </div>
  );
}

function DoneOption({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-left text-sm font-medium text-[#0F172A] transition hover:border-accent/20 hover:bg-accent-muted/30 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
