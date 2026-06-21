"use client";

import { CalmTypingIndicator } from "@/app/components/calm-loading";
import { calmLoadingMessages } from "@/lib/calm-system-copy";

type InboxLoadingStateProps = {
  locale: "en" | "it";
  message?: string;
};

/** Calm loading — rotating poetic whispers, never technical. */
export function InboxLoadingState({ locale, message }: InboxLoadingStateProps) {
  const fallback = calmLoadingMessages(locale)[0] ?? calmLoadingMessages("en")[0]!;

  return (
    <section
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 calm-fade-in"
      aria-busy="true"
      aria-live="polite"
    >
      <CalmTypingIndicator />
      <p
        className={`text-sm text-gray-500 transition-opacity duration-300 ${message ? "opacity-100" : "opacity-90"}`}
      >
        {message ?? fallback}
      </p>
    </section>
  );
}
