"use client";

import Link from "next/link";
import { useState } from "react";
import type { ConnectedGmailAccount } from "@/lib/gmail/account-types";
import { startConnectGmailAccount } from "@/lib/gmail/connect-account-client";

export type AccountFilterValue = "all" | string;

type AccountFilterProps = {
  accounts: ConnectedGmailAccount[];
  value: AccountFilterValue;
  locale?: "en" | "it";
  onChange: (value: AccountFilterValue) => void;
};

const COPY = {
  en: {
    all: "All Accounts",
    helper: "Connect another Gmail account to manage multiple inboxes in one place.",
    planNote: "Additional accounts may require a higher plan later.",
    connect: "+ Connect another Gmail account",
    settings: "Manage in Settings",
    connecting: "Opening Google…",
  },
  it: {
    all: "Tutti gli account",
    helper: "Collega un altro account Gmail per gestire più inbox in un unico posto.",
    planNote: "Account aggiuntivi potrebbero richiedere un piano superiore in futuro.",
    connect: "+ Collega un altro account Gmail",
    settings: "Gestisci in Impostazioni",
    connecting: "Apertura Google…",
  },
} as const;

export function AccountFilter({
  accounts,
  value,
  locale = "en",
  onChange,
}: AccountFilterProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = COPY[locale];
  const showConnectCta = accounts.length <= 1;

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    const result = await startConnectGmailAccount();
    if (!result.ok) {
      setError(result.message);
      setConnecting(false);
    }
  };

  if (accounts.length === 0) return null;

  return (
    <div className="space-y-2.5 rounded-xl border border-gray-100 bg-white/80 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {locale === "it" ? "Account" : "Account"}
        </span>
        <FilterPill
          active={value === "all"}
          onClick={() => onChange("all")}
          label={t.all}
        />
        {accounts.map((account) => (
          <FilterPill
            key={account.id}
            active={value === account.id}
            onClick={() => onChange(account.id)}
            label={account.label}
            sublabel={account.isPrimary ? (locale === "it" ? "Principale" : "Primary") : undefined}
          />
        ))}
      </div>

      {showConnectCta ? (
        <div className="space-y-2 border-t border-gray-50 pt-2.5">
          <p className="text-sm leading-relaxed text-gray-600">{t.helper}</p>
          <p className="text-xs text-gray-400">{t.planNote}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={connecting}
              className="text-sm font-medium text-accent transition hover:text-accent/80 disabled:opacity-60"
            >
              {connecting ? t.connecting : t.connect}
            </button>
            <Link
              href="/settings#connected-accounts"
              className="text-xs text-gray-500 transition hover:text-gray-700"
            >
              {t.settings}
            </Link>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  sublabel,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ${
        active
          ? "border-gray-300 bg-white text-[#0F172A] shadow-sm"
          : "border-transparent bg-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-700"
      }`}
    >
      <span>{label}</span>
      {sublabel ? (
        <span className="text-[10px] font-normal text-gray-400">{sublabel}</span>
      ) : null}
    </button>
  );
}
