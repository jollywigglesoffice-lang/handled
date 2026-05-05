"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { FREE_LIMIT, readUsageCountWithDailyReset } from "@/lib/daily-usage";

const PRICING = {
  pro: {
    name: "Pro",
    price: "€9",
    period: "/month",
    features: [
      "Unlimited replies",
      "Smarter tone control",
      "Faster AI responses",
      "Priority improvements",
    ],
  },
};

function trackEvent(name: string, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  let existing: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("analytics") || "[]");
    existing = Array.isArray(parsed) ? parsed : [];
  } catch {
    existing = [];
  }
  existing.push({ name, data, time: Date.now() });
  localStorage.setItem("analytics", JSON.stringify(existing));
}

export function AccountSettings() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    void supabaseBrowser.auth.getUser().then(({ data }) => {
      setAuthUser(data.user ?? null);
    });
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const userId = authUser?.id ?? null;

  const refreshUsage = useCallback(() => {
    if (!userId) {
      setUsageCount(0);
      return;
    }
    setUsageCount(readUsageCountWithDailyReset(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setIsPro(false);
      setUsageCount(0);
      return;
    }

    void fetch(`/api/get-user?userId=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data: { isPro?: boolean }) => {
        setIsPro(Boolean(data.isPro));
      })
      .catch(() => {
        setIsPro(false);
      });

    refreshUsage();
  }, [userId, refreshUsage]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshUsage();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshUsage]);

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!authUser) {
    return null;
  }

  return (
    <>
      <div className="mt-4 space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Account
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">{authUser.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Plan</p>
            <p className="text-sm font-semibold text-gray-900">
              {isPro ? "Pro" : "Free"}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Replies left
            </p>
            <p className="text-sm font-semibold text-indigo-600">
              {isPro ? "Unlimited" : Math.max(0, FREE_LIMIT - usageCount)}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Free daily limit: {FREE_LIMIT} reply uses per day (Pro is unlimited).
        </p>

        {!isPro ? (
          <button
            type="button"
            onClick={() => setShowUpgrade(true)}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Upgrade to Pro
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>

      {showUpgrade ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="w-[90%] max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">
              Unlock Unlimited Replies
            </h2>

            <p className="mb-4 text-sm text-gray-500">
              You&apos;ve reached today&apos;s free limit. Upgrade to continue without
              interruptions.
            </p>

            <div className="mb-4 rounded-lg border border-gray-200 bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-gray-700">{PRICING.pro.name}</p>

              <span className="mt-0.5 block text-[10px] font-medium text-indigo-500">
                Most popular
              </span>

              <p className="text-xl font-bold text-indigo-600">
                {PRICING.pro.price}
                <span className="text-sm text-gray-500">{PRICING.pro.period}</span>
              </p>

              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {PRICING.pro.features.map((f, i) => (
                  <li key={i}>✔ {f}</li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white shadow-md transition hover:bg-indigo-700"
              onClick={async () => {
                trackEvent("upgrade_clicked");
                const res = await fetch("/api/create-checkout-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "same-origin",
                  body: JSON.stringify({
                    userId,
                    email: authUser.email,
                  }),
                });
                const data = (await res.json()) as { url?: string; error?: string };
                if (data.url) {
                  window.location.href = data.url;
                }
              }}
            >
              Upgrade to Pro
            </button>

            <button
              type="button"
              onClick={() => setShowUpgrade(false)}
              className="mt-2 w-full text-sm text-gray-400"
            >
              Maybe later
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
