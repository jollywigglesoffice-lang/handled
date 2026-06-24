"use client";

import { useState } from "react";
import { startAttachInbox } from "@/lib/gmail/connect-account-client";

type AttachInboxButtonProps = {
  locale?: "en" | "it";
  /** header = compact “+ Add inbox”; primary = OAuth “Attach inbox”; link = text CTA */
  variant?: "header" | "primary" | "link";
  next?: string;
  className?: string;
};

const COPY = {
  en: {
    addInbox: "+ Add inbox",
    attachInbox: "Attach inbox",
    opening: "Opening Google…",
  },
  it: {
    addInbox: "+ Aggiungi inbox",
    attachInbox: "Allega inbox",
    opening: "Apertura Google…",
  },
} as const;

export function AttachInboxButton({
  locale = "en",
  variant = "primary",
  next,
  className = "",
}: AttachInboxButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = COPY[locale];

  async function handleClick() {
    setBusy(true);
    setError(null);
    const result = await startAttachInbox({ next });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
    }
  }

  const label =
    busy ? t.opening : variant === "header" ? t.addInbox : t.attachInbox;

  const baseClass =
    variant === "header"
      ? "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-accent transition hover:border-accent/30 hover:bg-accent-muted/20 disabled:opacity-60"
      : variant === "link"
        ? "text-sm font-medium text-accent transition hover:text-accent/80 disabled:opacity-60"
        : "inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60";

  return (
    <span className={className}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className={baseClass}
      >
        {label}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </span>
  );
}
