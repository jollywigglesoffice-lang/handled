"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function SuccessPage() {
  const [referralCopied, setReferralCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [planStatusMessage, setPlanStatusMessage] = useState(
    "Syncing your Pro status...",
  );
  const [referralCode, setReferralCode] = useState("handled");

  const referralLink = useMemo(() => {
    if (typeof window === "undefined") return "https://handled.app/?ref=handled";
    return `${window.location.origin}/?ref=${referralCode}`;
  }, [referralCode]);

  async function refreshPlanStatus(userId: string) {
    const res = await fetch(`/api/get-user?userId=${encodeURIComponent(userId)}`);
    const profile = (await res.json()) as { isPro?: boolean };
    return Boolean(profile.isPro);
  }

  function copyReferralInvite() {
    if (typeof window === "undefined") return;

    navigator.clipboard?.writeText(
      `I’m using Handled to write smarter email replies faster. Try it here: ${referralLink}`
    );

    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    void supabaseBrowser.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user?.id) {
        setPlanStatusMessage("Pro activation may take a few seconds.");
        return;
      }

      setReferralCode(user.id.slice(0, 8));

      let attempts = 0;
      while (attempts < 3) {
        attempts += 1;
        try {
          const isPro = await refreshPlanStatus(user.id);
          if (isPro) {
            setPlanStatusMessage("Pro is active. Everything is ready.");
            return;
          }
        } catch (error) {
          console.error("success plan sync error", error);
        }

        if (attempts < 3) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }

      setPlanStatusMessage("Pro activation may take a few seconds. Open Settings to confirm.");
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (secondsLeft <= 0) {
      window.location.href = "/emails";
      return;
    }

    const id = window.setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  function goToInboxNow() {
    if (typeof window === "undefined") return;
    window.location.href = "/emails";
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
              Enjoy unlimited replies and a more powerful Handled experience.
            </p>

            <p className="mt-4 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm font-medium text-indigo-700">
              {planStatusMessage}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-indigo-100 bg-white/80 p-4">
          <h2 className="text-sm font-semibold text-gray-900">What&apos;s included in Pro</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">Unlimited AI replies</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">Smarter workflow modes</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">Faster reply generation</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">Early access to new features</p>
            </div>
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

              <p className="mt-2 break-all rounded-lg border border-purple-100 bg-white px-3 py-2 text-xs leading-relaxed text-purple-700">
                {referralLink}
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
            {referralCopied ? "Invite copied!" : "Copy invite"}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={goToInboxNow}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Go to inbox
          </button>

          <Link
            href="/settings"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Open settings
          </Link>
        </div>

        <p className="mt-4 text-center text-sm font-medium text-gray-500">
          Redirecting to your inbox in {secondsLeft} seconds...
        </p>

        <p className="mt-5 text-center text-xs leading-relaxed text-gray-400">
          Handled never sends emails without your approval.
        </p>
      </section>
    </main>
  );
}
