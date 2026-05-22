import Link from "next/link";
import { buildLoginUrl } from "@/lib/auth/app-origin";

type EmailDetailAuthRequiredProps = {
  emailId: string;
  reason: "sign_in" | "connect_gmail";
};

export function EmailDetailAuthRequired({
  emailId,
  reason,
}: EmailDetailAuthRequiredProps) {
  const nextPath = `/emails/${encodeURIComponent(emailId)}`;
  const loginHref = buildLoginUrl(nextPath);

  const title =
    reason === "connect_gmail" ? "Connect Gmail to open this email" : "Sign in to view this email";
  const description =
    reason === "connect_gmail"
      ? "You’re signed in, but Handled needs Google read-only access to load this message. Sign in with Google using the same account."
      : "Sign in to load Gmail messages, save preferences, and use AI replies on this thread.";

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <Link
          href="/emails"
          className="text-sm font-medium text-[#6366F1] transition hover:opacity-90"
        >
          ← Back to inbox
        </Link>
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm space-y-4">
          <h1 className="text-xl font-semibold text-[#0F172A]">{title}</h1>
          <p className="text-sm leading-relaxed text-gray-500">{description}</p>
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Handled never sends email without your approval.
          </p>
          <Link
            href={loginHref}
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {reason === "connect_gmail" ? "Continue with Google" : "Sign in"}
          </Link>
        </section>
      </div>
    </main>
  );
}
