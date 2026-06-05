"use client";

import { LIFECYCLE_LABELS, type EmailLifecycleState } from "@/lib/email-lifecycle";

type EmailLifecycleIndicatorProps = {
  state: EmailLifecycleState;
  locale: "en" | "it";
  /** Show symbol + label (default) or symbol only */
  symbolOnly?: boolean;
};

const SYMBOL: Record<EmailLifecycleState, string> = {
  unread: "●",
  read: "○",
  completed: "✓",
};

const STYLES: Record<EmailLifecycleState, string> = {
  unread: "text-[#9733ff]",
  read: "text-gray-400",
  completed: "text-emerald-700",
};

export function EmailLifecycleIndicator({
  state,
  locale,
  symbolOnly = false,
}: EmailLifecycleIndicatorProps) {
  const label = LIFECYCLE_LABELS[locale][state];

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${STYLES[state]}`}
      title={label}
      aria-label={label}
    >
      <span aria-hidden className="text-[11px] leading-none">
        {SYMBOL[state]}
      </span>
      {symbolOnly ? null : <span>{label}</span>}
    </span>
  );
}
