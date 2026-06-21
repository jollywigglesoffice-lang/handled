"use client";

import type { InboxInteractionMode } from "@/lib/inbox-interaction-mode";

type InboxModeToggleProps = {
  mode: InboxInteractionMode;
  locale: "en" | "it";
  queueCount: number;
  onChange: (mode: InboxInteractionMode) => void;
};

const COPY = {
  en: {
    standard: "Normal",
    inboxZero: "Inbox Zero",
    inboxZeroHint: (n: number) =>
      n > 0 ? `${n} in queue` : "Nothing in queue",
  },
  it: {
    standard: "Normale",
    inboxZero: "Inbox Zero",
    inboxZeroHint: (n: number) =>
      n > 0 ? `${n} in coda` : "Niente in coda",
  },
} as const;

export function InboxModeToggle({ mode, locale, queueCount, onChange }: InboxModeToggleProps) {
  const t = COPY[locale];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-1 rounded-lg bg-gray-50 p-0.5">
        <ModeTab
          label={t.standard}
          active={mode === "standard"}
          onClick={() => onChange("standard")}
        />
        <ModeTab
          label={t.inboxZero}
          active={mode === "inbox_zero"}
          onClick={() => onChange("inbox_zero")}
        />
      </div>
      {mode === "inbox_zero" ? (
        <p className="text-xs text-gray-400">{t.inboxZeroHint(queueCount)}</p>
      ) : null}
    </div>
  );
}

function ModeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
        active
          ? "bg-white font-medium text-gray-900 shadow-sm"
          : "font-normal text-gray-400 hover:text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}
