"use client";

const COPY = {
  en: "Waiting item updated",
  it: "Voce in attesa aggiornata",
} as const;

export function WaitingResponseBadge({ locale }: { locale: "en" | "it" }) {
  return (
    <span
      className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900"
      title={COPY[locale]}
    >
      {COPY[locale]}
    </span>
  );
}
