"use client";

import { useState } from "react";
import Link from "next/link";

export default function SuccessPage() {
  const [referralCopied, setReferralCopied] = useState(false);

  function copyReferralInvite() {
    if (typeof window === "undefined") return;

    navigator.clipboard?.writeText(
      `I’m using Handled to write smarter email replies faster. Try it here: ${window.location.origin}`
    );

    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-md">
            ✨
          </div>

          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
              Upgrade successful
            </p>

            <h1 className="mt-1 text-3xl font-semibold text-gray-900">
              You’re Pro 🎉
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Thank you for upgrading to Handled Pro. You now have a faster,
              calmer way to handle email with unlimited AI reply support.
            </p>

            <p className="mt-4 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm font-medium text-indigo-700">
              Pro activation may take a few seconds. If your account still shows
              Free, refresh Settings in a moment.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
            <p className="text-sm font-semibold text-gray-900">
              Unlimited replies
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Generate, refine, and adjust replies without daily limits.
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
            <p className="text-sm font-semibold text-gray-900">
              Smarter workflows
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Use Assist Me, Clean My Inbox, and Handle It For Me with more freedom.
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
            <p className="text-sm font-semibold text-gray-900">
              Early access
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Pro users get first access to multiple inboxes and upcoming AI features.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-purple-100 bg-purple-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-purple-800">
                Invite a friend, get rewarded
              </p>

              <p className="mt-1 text-sm leading-relaxed text-purple-700">
                Share Handled with a friend. When they upgrade, you’ll get 1 free month of Pro.
              </p>

              <p className="mt-2 text-xs leading-relaxed text-purple-500">
                Referral tracking is coming soon — for now, tell friends to mention your email when they join.
              </p>
            </div>

            <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-[10px] font-semibold text-purple-600">
              Reward
            </span>
          </div>

          <button
            type="button"
            onClick={copyReferralInvite}
            className="mt-4 w-full rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            {referralCopied ? "Invite copied!" : "Copy referral invite"}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/emails"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Start using Pro
          </Link>

          <Link
            href="/settings"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Review Settings & Billing
          </Link>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-gray-400">
          Handled never sends emails without your approval.
        </p>
      </section>
    </main>
  );
}
