"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { FREE_LIMIT, readUsageCountWithDailyReset } from "@/lib/daily-usage";
import { WORKFLOW_MODE_KEY, type WorkflowMode } from "@/lib/workflow-mode";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import { persistWorkflowModeToAccount, syncWorkflowModeFromAccount } from "@/lib/workflow-mode/client-sync";
import { WorkflowModeSelector } from "./workflow-mode-selector";
import { HandledBrainSettings } from "./handled-brain-settings";
import { InboxPrioritySettings } from "./inbox-priority-settings";
import { SenderRelationshipsSettings } from "./sender-relationships-settings";
import { SenderRulesSettings } from "./sender-rules-settings";
import { IdentitySettings } from "./identity-settings";
import { PersonalizationSettings } from "./personalization-settings";
import { useUiCopy } from "@/app/use-ui-copy";

export default function SettingsPage() {
  const ui = useUiCopy();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [billingLoading, setBillingLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [activationMessage, setActivationMessage] = useState("");
  const [showProCelebration, setShowProCelebration] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(() => {
    if (typeof window === "undefined") return "assist";
    return (
      (localStorage.getItem(WORKFLOW_MODE_KEY) as WorkflowMode | null) || "assist"
    );
  });
  const [workflowModeSaveStatus, setWorkflowModeSaveStatus] = useState<SaveStatusState>("idle");

  async function updateWorkflowMode(mode: WorkflowMode) {
    setWorkflowMode(mode);
    setWorkflowModeSaveStatus("saving");
    const { ok } = await persistWorkflowModeToAccount(mode);
    setWorkflowModeSaveStatus(ok ? "synced" : "offline");
    window.dispatchEvent(new Event("handled-workflow-mode-changed"));
    window.setTimeout(() => setWorkflowModeSaveStatus("idle"), 2500);
  }

  useEffect(() => {
    if (!authUser?.id) return;
    void syncWorkflowModeFromAccount().then((mode) => {
      setWorkflowMode(mode);
    });
  }, [authUser?.id]);

  async function refreshUserProfile(userId: string) {
    const res = await fetch(`/api/get-user?userId=${encodeURIComponent(userId)}`);
    const profile = (await res.json()) as { isPro?: boolean };
    setIsPro(Boolean(profile.isPro));
    return Boolean(profile.isPro);
  }

  const refreshPlanStatus = useCallback(async () => {
    if (!authUser?.id) return;

    try {
      const res = await fetch(`/api/get-user?userId=${encodeURIComponent(authUser.id)}`);
      const data = (await res.json()) as { isPro?: boolean };
      setIsPro(Boolean(data.isPro));
      console.log("Plan refresh:", data);
    } catch (error) {
      console.error("refresh plan failed", error);
    }
  }, [authUser?.id]);

  useEffect(() => {
    let mounted = true;

    async function syncProfileForUser(user: User | null) {
      if (!mounted) return;
      if (!user?.id) {
        setIsPro(false);
        setUsageCount(0);
        return;
      }
      try {
        await fetch("/api/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            email: user.email ?? "",
          }),
        });
        await refreshUserProfile(user.id);
        if (!mounted) return;
        setUsageCount(readUsageCountWithDailyReset(user.id));
      } catch (error) {
        if (!mounted) return;
        console.error("settings load user error", error);
      }
    }

    async function loadUser() {
      try {
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const sessionUser = sessionData.session?.user ?? null;

        if (sessionUser) {
          if (!mounted) return;
          setAuthUser(sessionUser);
          setIsLoading(false);
          await syncProfileForUser(sessionUser);
          return;
        }

        const { data: userData } = await supabaseBrowser.auth.getUser();

        if (!mounted) return;

        setAuthUser(userData.user ?? null);
        setIsLoading(false);
        await syncProfileForUser(userData.user ?? null);
      } catch (error) {
        console.error("settings auth load error", error);
        if (!mounted) return;
        setAuthUser(null);
        setIsLoading(false);
      }
    }

    void loadUser();

    const { data: listener } = supabaseBrowser.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null);
        setIsLoading(false);
        void syncProfileForUser(session?.user ?? null);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser?.id) return;
    void refreshPlanStatus();
  }, [authUser?.id, refreshPlanStatus]);

  useEffect(() => {
    const onProSynced = () => {
      void refreshPlanStatus();
    };
    window.addEventListener("handled-pro-updated", onProSynced);
    return () => window.removeEventListener("handled-pro-updated", onProSynced);
  }, [refreshPlanStatus]);

  useEffect(() => {
    if (!authUser?.id) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;

    void (async () => {
      try {
        const res = await fetch("/api/verify-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json()) as { ok?: boolean };
        if (res.ok && data.ok) {
          console.log("[settings] Pro synced via checkout session verify");
          window.dispatchEvent(new Event("handled-pro-updated"));
          await refreshUserProfile(authUser.id);
        } else {
          console.warn("[settings] verify-checkout-session:", res.status, data);
        }
      } catch (error) {
        console.error("[settings] verify-checkout-session failed", error);
      }
    })();
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get("upgraded");

    if (upgraded !== "true") {
      setShowProCelebration(false);
      return;
    }

    setShowProCelebration(true);

    setActivationMessage("Payment received. Activating Pro...");

    let attempts = 0;

    const interval = window.setInterval(async () => {
      attempts += 1;

      const active = await refreshUserProfile(authUser.id);

      if (active) {
        setActivationMessage("Pro is active 🎉");
        window.clearInterval(interval);
        return;
      }

      if (attempts >= 10) {
        setActivationMessage(
          "Payment succeeded, but Pro is still activating. Refresh in a moment.",
        );
        window.clearInterval(interval);
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [authUser?.id]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && authUser?.id) {
        setUsageCount(readUsageCountWithDailyReset(authUser.id));
        void refreshPlanStatus();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [authUser?.id, refreshPlanStatus]);

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    window.location.href = "/";
  }

  async function handleUpgrade() {
    setCheckoutError("");

    if (!authUser?.id || !authUser?.email) {
      setCheckoutError("You need to be signed in before upgrading.");
      console.error("Missing auth user for checkout", authUser);
      return;
    }

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

      if (!res.ok) {
        console.error("checkout failed", data);
        setCheckoutError(data?.error || "Checkout failed. Please try again.");
        setCheckoutLoading(false);
        return;
      }

      if (!data.url) {
        console.error("No checkout URL returned", data);
        setCheckoutError("Checkout did not return a payment link.");
        setCheckoutLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("checkout error", error);
      setCheckoutError("Could not open checkout. Please try again.");
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
        credentials: "same-origin",
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
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-sm text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Sign in required
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Please sign in to view your settings, billing, and Pro access.
          </p>

          <a
            href="/login?next=/settings"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Sign in
          </a>
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
            <p className="text-[10px] text-gray-400">
              Auth debug:{" "}
              {authUser?.email ? `signed in as ${authUser.email}` : "not signed in"}
            </p>
          </div>

          <Link
            href="/emails"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Back to inbox
          </Link>
        </header>

        {showProCelebration && (
          <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-md">
                ✨
              </div>

              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                  Upgrade successful
                </p>

                <h2 className="mt-1 text-3xl font-semibold text-gray-900">You&apos;re Pro 🎉</h2>

                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Thank you for upgrading to Handled Pro. You now have a faster, calmer way to
                  handle email with unlimited AI reply support.
                </p>

                {activationMessage && (
                  <p className="mt-4 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm font-medium text-indigo-700">
                    {activationMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
                <p className="text-sm font-semibold text-gray-900">Unlimited replies</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Generate, refine, and adjust replies without daily limits.
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
                <p className="text-sm font-semibold text-gray-900">Smarter workflows</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Use Assist Me, Clean My Inbox, and Handle It For Me with more freedom.
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
                <p className="text-sm font-semibold text-gray-900">Early access</p>
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
                    Share Handled with a friend. When they upgrade, you&apos;ll get 1 free month
                    of Pro.
                  </p>

                  <p className="mt-2 text-xs leading-relaxed text-purple-500">
                    Referral tracking is coming soon — for now, tell friends to mention your email
                    when they join.
                  </p>
                </div>

                <span className="rounded-full border border-purple-100 bg-white px-3 py-1 text-[10px] font-semibold text-purple-600">
                  Reward
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard?.writeText(
                      `I’m using Handled to write smarter email replies faster. Try it here: ${window.location.origin}`,
                    );
                    setReferralCopied(true);
                    setTimeout(() => setReferralCopied(false), 2000);
                  }
                }}
                className="mt-4 w-full rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700"
              >
                {referralCopied ? "Invite copied!" : "Copy referral invite"}
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/emails"
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Start using Pro
              </a>

              <a
                href="/settings"
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Review settings
              </a>
            </div>
          </section>
        )}

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
          <p className="mt-1 text-sm text-gray-500">Choose the plan that fits your workflow.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Handled Free</h3>
                  <p className="mt-1 text-sm text-gray-500">Perfect for trying Handled</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">€0</p>
                  <p className="text-xs text-gray-500">free</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>✔ 5 AI replies per day</li>
                <li>✔ Tone control</li>
                <li>✔ Saved preferences</li>
                <li>✔ Basic usage tracking</li>
              </ul>
              {!isPro ? (
                <span className="mt-4 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                  Current plan
                </span>
              ) : (
                <span className="mt-4 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500">
                  Available
                </span>
              )}
            </article>

            <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Handled Pro</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    For people who want unlimited calm
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-700">€9</p>
                  <p className="text-xs text-gray-500">/month</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>✔ Unlimited AI replies</li>
                <li>✔ Faster, smarter reply generation</li>
                <li>✔ Full workflow modes</li>
                <li>✔ Priority access to new features</li>
                <li>✔ Early access to multi-email support</li>
              </ul>
              {isPro ? (
                <div className="mt-4 space-y-3">
                  <span className="inline-flex rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                    Current plan
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleManageBilling()}
                    disabled={billingLoading}
                    className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
                  >
                    {billingLoading ? "Opening billing..." : "Manage Billing"}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={checkoutLoading}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {checkoutLoading ? "Opening checkout..." : "Upgrade to Pro — €9/month"}
                  </button>
                  {checkoutError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {checkoutError}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void refreshPlanStatus()}
                    className="mt-3 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Refresh plan status
                  </button>
                </div>
              )}
            </article>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Handled never sends emails without your approval.
          </p>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                Coming soon
              </p>

              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                Multiple email accounts
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Soon you&apos;ll be able to connect more than one inbox and manage your work,
                personal, and business emails from one calm place.
              </p>
            </div>

            <span className="rounded-full border border-indigo-100 bg-white px-3 py-1 text-[10px] font-semibold text-indigo-600">
              In progress
            </span>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
            <div className="rounded-xl border border-indigo-50 bg-white/70 p-3">
              ✔ Unified inbox
            </div>
            <div className="rounded-xl border border-indigo-50 bg-white/70 p-3">
              ✔ Separate identities
            </div>
            <div className="rounded-xl border border-indigo-50 bg-white/70 p-3">
              ✔ AI triage
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Pro users will get early access when this feature launches.
          </p>

          <p className="mt-3 text-xs leading-relaxed text-gray-400">
            Future Gmail integration will focus on drafting and organizing first. Sending will
            always require your approval.
          </p>
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
            Each mode changes categorization, replies, and inbox layout. Synced to your account.
          </p>
          <div className="mt-5">
            <WorkflowModeSelector value={workflowMode} onChange={updateWorkflowMode} />
            <SaveStatus status={workflowModeSaveStatus} className="mt-3 block" />
          </div>
        </section>

        <HandledBrainSettings />
        <SenderRulesSettings />
        <SenderRelationshipsSettings />
        <InboxPrioritySettings />
        <IdentitySettings />
        <PersonalizationSettings />

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Trust &amp; Safety</h2>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">You approve every reply</p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-700">
                Handled never sends emails without your approval. It helps you draft, refine, and
                decide faster.
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">
                Your preferences improve your experience
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                Your workflow mode, tone settings, and reply habits help Handled make better
                suggestions for you.
              </p>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-indigo-800">Gmail connection is coming</p>
              <p className="mt-1 text-sm leading-relaxed text-indigo-700">
                When inbox connection launches, Handled will help you manage multiple email
                accounts from one calm place.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
