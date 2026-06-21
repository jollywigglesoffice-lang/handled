"use client";

type EmailSoftSchedulingHintProps = {
  locale: "en" | "it";
};

const COPY = {
  en: {
    body: "This may need a meeting — reply when you're ready. Handled won't suggest times unless the email explicitly asks to schedule.",
  },
  it: {
    body: "Potrebbe servire un incontro — rispondi quando vuoi. Handled non suggerisce orari finché l'email non chiede esplicitamente di programmare.",
  },
} as const;

/** Soft time intent — quiet nudge only, no slot picker or calendar assumptions. */
export function EmailSoftSchedulingHint({ locale }: EmailSoftSchedulingHintProps) {
  const t = COPY[locale];
  return (
    <p className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm leading-relaxed text-gray-600">
      {t.body}
    </p>
  );
}
