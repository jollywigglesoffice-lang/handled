import Link from "next/link";
import { calmErrorBody, calmErrorTitle, calmRetryLabel } from "@/lib/calm-system-copy";

type EmailDetailLoadErrorProps = {
  emailId: string;
  message: string;
  locale?: "en" | "it";
  onRetryHref?: string;
};

export function EmailDetailLoadError({
  emailId,
  message,
  locale = "en",
  onRetryHref,
}: EmailDetailLoadErrorProps) {
  const retryHref = onRetryHref ?? `/emails/${encodeURIComponent(emailId)}`;
  const title = calmErrorTitle("slippedAway", locale);
  const fallbackMessage = calmErrorBody("slippedAway", locale);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <Link
          href="/emails"
          className="text-sm font-medium text-accent transition hover:opacity-90"
        >
          ← {locale === "it" ? "Torna alla inbox" : "Back to inbox"}
        </Link>
        <section
          role="alert"
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm leading-relaxed text-gray-600">{message || fallbackMessage}</p>
          <a
            href={retryHref}
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:border-accent/30 hover:bg-accent-muted/20"
          >
            {calmRetryLabel(locale)}
          </a>
        </section>
      </div>
    </main>
  );
}
