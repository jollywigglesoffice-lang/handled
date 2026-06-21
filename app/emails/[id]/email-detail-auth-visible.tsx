"use client";

import Link from "next/link";
import { useUiCopy } from "@/app/use-ui-copy";
import { AttachInboxButton } from "@/app/emails/attach-inbox-button";

/** Visible auth state — attach flow never sends users to /login. */
export function EmailDetailAuthVisible({
  emailId,
  reason,
}: {
  emailId: string;
  reason: "sign_in" | "connect_gmail" | "server_session";
}) {
  const ui = useUiCopy();
  const nextPath = `/emails/${encodeURIComponent(emailId)}`;

  const title =
    reason === "connect_gmail"
      ? "Attach inbox to open this email"
      : reason === "server_session"
        ? "Sign in again to open this email"
        : "Sign in to open this email";

  const description =
    reason === "connect_gmail"
      ? "Pick the Gmail inbox for this message — one Handled login, switch sources anytime."
      : reason === "server_session"
        ? "Handled needs a fresh session in this tab — sign in once and you should be set."
        : "Open this email after signing in — nothing sends without you.";

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-16 sm:px-6">
      <div className="mx-auto w-full max-w-lg space-y-4 calm-fade-in">
        <Link href="/emails" className="text-sm text-gray-400 hover:text-gray-600">
          {ui.common.backToInbox}
        </Link>
        <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-3">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h1>
          <p className="text-sm leading-relaxed text-gray-600">{description}</p>
          {reason === "connect_gmail" ? (
            <AttachInboxButton variant="primary" next={nextPath} className="mt-2" />
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="btn-primary-sm mt-2 inline-flex"
            >
              Continue with Google
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
