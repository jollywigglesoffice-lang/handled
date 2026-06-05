"use client";

import { useState } from "react";
import { CompletionActionPicker } from "@/app/emails/completion-action-picker";
import type { CompletionActionId } from "@/lib/completion-actions/types";

type DoneWithThisPanelProps = {
  locale: "en" | "it";
  compact?: boolean;
  onComplete: (actionId: CompletionActionId, actionLabel: string) => void | Promise<void>;
  onDismiss?: () => void;
};

const COPY = {
  en: { dismiss: "Not now" },
  it: { dismiss: "Non ora" },
} as const;

export function DoneWithThisPanel({
  locale,
  compact,
  onComplete,
  onDismiss,
}: DoneWithThisPanelProps) {
  const [busy, setBusy] = useState(false);
  const t = COPY[locale];

  async function handleSelect(actionId: CompletionActionId, actionLabel: string) {
    setBusy(true);
    try {
      await onComplete(actionId, actionLabel);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-4"
          : "rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white p-6 shadow-sm"
      }
    >
      <CompletionActionPicker
        locale={locale}
        compact={compact}
        busy={busy}
        onSelect={(id, label) => void handleSelect(id, label)}
      />
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600"
        >
          {t.dismiss}
        </button>
      ) : null}
    </div>
  );
}
