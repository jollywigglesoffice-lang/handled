"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { FREE_LIMIT, readUsageCountWithDailyReset } from "@/lib/daily-usage";
import { ModeSelector } from "./mode-selector";
import { PersonalizationSettings } from "./personalization-settings";

export default function SettingsPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [billingLoading, setBillingLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const loadUser = useCallback(async () => {
    const { data } = await supabaseBrowser.auth.getUser();
    const user = data.user ?? null;
    setAuthUser(user);

    if (user?.id) {
      try {
        const res = await fetch(`/api/get-user?userId=${encodeURIComponent(user.id)}`);
        const profile = (await res.json()) as { isPro?: boolean };
        setIsPro(Boolean(profile.isPro));
        setUsageCount(readUsageCountWithDailyReset(user.id));
      } catch (error) {
        console.error("settings load user error", error);
      }
    } else {
      setIsPro(false);
      setUsageCount(0);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange(() => {
      void loadUser();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [loadUser]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && authUser?.id) {
        setUsageCount(readUsageCountWithDailyReset(authUser.id));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [authUser?.id]);

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    window.location.href = "/";
  }

  async function handleUpgrade() {
    if (!authUser?.id || !authUser?.email) return;

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: authUser.id,
          email: authUser.email,
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch (error) {
      console.error("checkout error", error);
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleManageBilling() {
    if (!authUser?.id || !authUser?.email) return;

    setBillingLoading(true);
    try {
      const res = await fetch("/api/create-billing-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: authUser.id,
          email: authUser.email,
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch (error) {
      console.error("billing portal error", error);
    } finally {
      setBillingLoading(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
        <div className="text-sm text-gray-500">Loading settings...</div>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Sign in required</h1>
          <p className="mt-3 text-sm text-gray-500">
            Please sign in to view your account settings.
          </p>
          <Link
            href="/emails/budget-approval-april"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Go to Handled
          </Link>
        </section>
      </main>
    );
  }

  const repliesLeft = Math.max(0, FREE_LIMIT - usageCount);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
              Handled
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-[#0F172A]">Settings</h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage your account, plan, billing, and preferences.
            </p>
          </div>

          <Link
            href="/emails/budget-approval-april"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Back to app
          </Link>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>
              <p className="mt-1 text-sm text-gray-500">Signed in as</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900">
                {authUser.email}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isPro ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"
              }`}
            >
              {isPro ? "Pro" : "Free"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
          >
            Sign out
          </button>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Plan & Billing</h2>

          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {isPro ? "Handled Pro" : "Handled Free"}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {isPro
                    ? "Unlimited replies and premium AI workflow."
                    : "5 free replies per day. Upgrade anytime for unlimited access."}
                </p>
              </div>

              <div className="text-right">
                <p className="text-2xl font-bold text-indigo-600">{isPro ? "€9" : "€0"}</p>
                <p className="text-xs text-gray-500">{isPro ? "/month" : "free"}</p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li>✔ AI-generated replies</li>
              <li>✔ Tone control</li>
              <li>✔ Saved preferences</li>
              <li>✔ Usage tracking</li>
              {isPro ? <li>✔ Unlimited replies</li> : null}
            </ul>

            {!isPro ? (
              <button
                type="button"
                onClick={() => void handleUpgrade()}
                disabled={checkoutLoading}
                className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {checkoutLoading ? "Opening checkout..." : "Upgrade to Pro — €9/month"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleManageBilling()}
                disabled={billingLoading}
                className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {billingLoading ? "Opening billing..." : "Manage Billing"}
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Usage</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Replies used today
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {isPro ? "Unlimited" : usageCount}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Replies left today
              </p>
              <p className="mt-1 text-xl font-semibold text-indigo-600">
                {isPro ? "Unlimited" : repliesLeft}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Daily free limit
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {isPro ? "Unlimited" : FREE_LIMIT}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Workflow modes</h2>
          <p className="mt-2 text-sm text-gray-500">
            Choose how Handled should assist with your inbox.
          </p>
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <ModeSelector />
          </div>
        </section>

        <PersonalizationSettings />
      </div>
    </main>
  );
}
