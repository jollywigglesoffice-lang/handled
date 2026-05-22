import Link from "next/link";

type EmailDetailLoadErrorProps = {
  emailId: string;
  message: string;
  onRetryHref?: string;
};

export function EmailDetailLoadError({
  emailId,
  message,
  onRetryHref,
}: EmailDetailLoadErrorProps) {
  const retryHref = onRetryHref ?? `/emails/${encodeURIComponent(emailId)}`;

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <Link
          href="/emails"
          className="text-sm font-medium text-[#6366F1] transition hover:opacity-90"
        >
          ← Back to inbox
        </Link>
        <section
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm space-y-4"
        >
          <h1 className="text-xl font-semibold text-red-900">Couldn&apos;t load this email</h1>
          <p className="text-sm leading-relaxed text-red-800">{message}</p>
          <a
            href={retryHref}
            className="inline-flex w-full items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-100"
          >
            Try again
          </a>
        </section>
      </div>
    </main>
  );
}
