import Link from "next/link";

/** Visible auth state — no redirect to /login. */
export function EmailDetailAuthVisible({
  emailId,
  reason,
}: {
  emailId: string;
  reason: "sign_in" | "connect_gmail" | "server_session";
}) {
  const title =
    reason === "connect_gmail"
      ? "Connect Gmail to open this email"
      : reason === "server_session"
        ? "Session not available on server"
        : "Sign in to open this email";

  const description =
    reason === "connect_gmail"
      ? "Browser session exists but Google read-only token is missing. Sign in with Google."
      : reason === "server_session"
        ? "Inbox may work in the browser while API cookies are missing. Try signing in again from this tab."
        : "No active session in this browser tab.";

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <Link href="/emails" className="text-sm font-medium text-accent">
          ← Back to inbox
        </Link>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm space-y-3">
          <h1 className="text-xl font-semibold text-amber-900">{title}</h1>
          <p className="text-sm text-amber-800">{description}</p>
          <p className="text-xs text-amber-700">
            Email id: <code>{emailId}</code>
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/emails/${encodeURIComponent(emailId)}`)}`}
            className="inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Go to sign in (optional)
          </Link>
        </section>
      </div>
    </main>
  );
}
