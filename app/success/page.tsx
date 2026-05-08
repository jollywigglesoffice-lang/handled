"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function SuccessPage() {
  const [secondsLeft, setSecondsLeft] = useState(7);
  const [referralCopied, setReferralCopied] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [referralCode, setReferralCode] = useState("handled-pro");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const user = sessionData.session?.user;

        if (!mounted || !user) return;

        setUserEmail(user.email || "");
        setReferralCode(user.id.slice(0, 8));
      } catch (error) {
        console.error("success page user load error", error);
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const referralLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/?ref=${referralCode}`;
  }, [referralCode]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      window.location.href = "/emails";
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  async function copyReferralInvite() {
    const inviteText = `I’m using Handled Pro to write smarter email replies faster. Try it here: ${referralLink}`;

    try {
      await navigator.clipboard.writeText(inviteText);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    } catch (error) {
      console.error("copy referral failed", error);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 shadow-sm">
        <p className="mb-4 rounded-full bg-indigo-600 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white">
          SUCCESS_PAGE_V2_ACTIVE
        </p>

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
              Thank you for upgrading to Handled Pro. You now have unlimited AI reply support and a calmer, faster way to handle email.
            </p>

            {userEmail && (
              <p className="mt-3 text-xs text-gray-400">
                Pro access is linked to {userEmail}.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-indigo-100 bg-white/80 p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            What’s included in Pro
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-gray-900">
                Unlimited AI replies
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                No daily reply limit. Generate and refine as much as you need.
              </p>
            </div>

            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-gray-900">
                Smarter workflow modes
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Use Assist Me, Clean My Inbox, and Handle It For Me with more freedom.
              </p>
            </div>

            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-gray-900">
                Faster email decisions
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Move from reading to replying with less hesitation.
              </p>
            </div>

            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-gray-900">
                Early access
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Pro users get first access to multiple inboxes and upcoming AI features.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-purple-100 bg-purple-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-purple-800">
                Invite a friend, get rewarded
              </p>

              <p className="mt-1 text-sm leading-relaxed text-purple-700">
                Share Handled with a friend. When they upgrade, you’ll get 1 free month of Pro.
              </p>

              <p className="mt-2 text-xs leading-relaxed text-purple-500">
                Referral tracking is coming soon — for now, ask friends to mention your email when they join.
              </p>
            </div>

            <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-[10px] font-semibold text-purple-600">
              Reward
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-purple-100 bg-white px-3 py-2 text-xs text-purple-700 break-all">
            {referralLink || "Preparing your invite link..."}
          </div>

          <button
            type="button"
            onClick={copyReferralInvite}
            className="mt-4 w-full rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            {referralCopied ? "Invite copied!" : "Copy referral invite"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          🔒 Handled still keeps you in control. It helps draft replies, but never sends emails without your approval.
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/emails"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Go to inbox now
          </Link>

          <Link
            href="/settings"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Open settings
          </Link>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-gray-400">
          Redirecting to your inbox in {secondsLeft} seconds...
        </p>
      </section>
    </main>
  );
}
