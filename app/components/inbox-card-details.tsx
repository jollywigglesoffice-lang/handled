"use client";

import { useState } from "react";

type InboxCardDetailsProps = {
  locale: "en" | "it";
  metaLine: string;
};

/** Collapsed AI/meta line — hidden until the user asks for details. */
export function InboxCardDetails({ locale, metaLine }: InboxCardDetailsProps) {
  const [open, setOpen] = useState(false);
  const toggleLabel = open
    ? locale === "it"
      ? "Nascondi"
      : "Hide"
    : locale === "it"
      ? "Dettagli"
      : "Details";

  if (!metaLine.trim()) return null;

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-gray-300 transition hover:text-gray-400"
        aria-expanded={open}
      >
        {toggleLabel}
      </button>
      {open ? (
        <p className="mt-1 max-w-prose truncate text-[11px] leading-relaxed text-gray-400/90">
          {metaLine}
        </p>
      ) : null}
    </div>
  );
}
