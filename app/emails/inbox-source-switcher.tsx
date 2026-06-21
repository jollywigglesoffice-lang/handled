"use client";

import Link from "next/link";
import { useState } from "react";
import type { ConnectedGmailAccount } from "@/lib/gmail/account-types";
import { startAttachInbox } from "@/lib/gmail/connect-account-client";

export type AccountFilterValue = "all" | string;

type InboxSourceSwitcherProps = {
  accounts: ConnectedGmailAccount[];
  value: AccountFilterValue;
  locale?: "en" | "it";
  onChange: (value: AccountFilterValue) => void;
};

const COPY = {
  en: {
    label: "Inbox",
    all: "All inboxes",
    attach: "Attach inbox",
    opening: "Opening Google…",
    settings: "Manage inboxes",
    helper: "Switch between inboxes — one Handled login, multiple Gmail sources.",
  },
  it: {
    label: "Inbox",
    all: "Tutte le inbox",
    attach: "Allega inbox",
    opening: "Apertura Google…",
    settings: "Gestisci inbox",
    helper: "Passa tra le inbox — un login Handled, più sorgenti Gmail.",
  },
} as const;

/** Slack-style inbox source picker — not separate logins. */
export function InboxSourceSwitcher({
  accounts,
  value,
  locale = "en",
  onChange,
}: InboxSourceSwitcherProps) {
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = COPY[locale];

  const handleAttach = async () => {
    setAttaching(true);
    setError(null);
    const result = await startAttachInbox({ next: "/emails?inbox_added=1" });
    if (!result.ok) {
      setError(result.message);
      setAttaching(false);
    }
  };

  if (accounts.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-gray-100 bg-white/90 px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
          {t.label}
        </span>
        <SourcePill
          active={value === "all"}
          onClick={() => onChange("all")}
          label={t.all}
        />
        {accounts.map((account) => (
          <SourcePill
            key={account.id}
            active={value === account.id}
            onClick={() => onChange(account.id)}
            label={account.label}
            sublabel={account.email}
            badge={account.isPrimary ? (locale === "it" ? "Principale" : "Primary") : undefined}
          />
        ))}
        <button
          type="button"
          onClick={() => void handleAttach()}
          disabled={attaching}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-accent transition hover:border-accent/40 hover:bg-accent-muted/20 disabled:opacity-60"
        >
          <span aria-hidden>+</span>
          {attaching ? t.opening : t.attach}
        </button>
        <Link
          href="/settings#connected-accounts"
          className="text-[10px] font-medium text-gray-400 transition hover:text-gray-600"
        >
          {t.settings}
        </Link>
      </div>
      {accounts.length > 1 ? (
        <p className="text-[11px] leading-relaxed text-gray-500">{t.helper}</p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

/** @deprecated Use InboxSourceSwitcher */
export const AccountFilter = InboxSourceSwitcher;

function SourcePill({
  active,
  onClick,
  label,
  sublabel,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={sublabel}
      className={`inline-flex max-w-[11rem] flex-col items-start rounded-full border px-3 py-1 text-left transition-colors duration-200 ${
        active
          ? "border-gray-300 bg-white text-[#0F172A] shadow-sm"
          : "border-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-700"
      }`}
    >
      <span className="flex w-full items-center gap-1.5 text-xs font-medium">
        <span className="truncate">{label}</span>
        {badge ? (
          <span className="shrink-0 text-[9px] font-normal text-gray-400">{badge}</span>
        ) : null}
      </span>
      {sublabel && active ? (
        <span className="max-w-full truncate text-[10px] font-normal text-gray-400">
          {sublabel}
        </span>
      ) : null}
    </button>
  );
}
