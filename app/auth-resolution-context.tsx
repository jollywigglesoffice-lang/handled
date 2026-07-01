"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AuthStatus } from "@/lib/auth/auth-resolution";
import { logAuthTransition } from "@/lib/auth/auth-resolution";
import { resetBootForSignOut, runBoot, type BootSnapshot } from "@/lib/auth/boot-controller";
import { InboxLoadingState } from "@/app/emails/inbox-loading-state";
import {
  fetchOnboardingGateStatus,
  INBOX_PATH,
  ONBOARDING_PATH,
  redirectOnceToDestination,
} from "@/lib/onboarding/post-auth-gate";

export type AuthResolutionContextValue = {
  authStatus: AuthStatus;
  userId: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;
  bootReady: boolean;
  onboardingComplete: boolean | null;
};

const AuthResolutionContext = createContext<AuthResolutionContextValue | null>(null);

export function useAuthResolution(): AuthResolutionContextValue {
  const ctx = useContext(AuthResolutionContext);
  if (!ctx) {
    throw new Error("useAuthResolution must be used within AuthResolutionProvider");
  }
  return ctx;
}

export function useOptionalAuthResolution(): AuthResolutionContextValue | null {
  return useContext(AuthResolutionContext);
}

/** Which post-auth surface this page expects — checked once after auth resolves. */
export type OnboardingGate = "none" | "inbox" | "onboarding";

type AuthResolutionProviderProps = {
  children: ReactNode;
  mode: "app" | "login";
  gate?: OnboardingGate;
  locale?: "en" | "it";
};

/**
 * 1. Resolve auth once
 * 2. Optional single onboarding gate (one API call, at most one redirect)
 * Never redirects to login or callback.
 */
export function AuthResolutionProvider({
  children,
  mode,
  gate = "none",
  locale = "en",
}: AuthResolutionProviderProps) {
  const [boot, setBoot] = useState<BootSnapshot | null>(null);
  const [gateReady, setGateReady] = useState(gate === "none");
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const gateCheckedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const snapshot = await runBoot({ mode });
      if (!cancelled) {
        setBoot(snapshot);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (gate === "none") {
      setGateReady(true);
      return;
    }

    if (!boot?.ready) return;

    if (boot.authStatus !== "authenticated") {
      setGateReady(true);
      return;
    }

    if (gateCheckedRef.current) return;
    gateCheckedRef.current = true;

    void (async () => {
      const status = await fetchOnboardingGateStatus();
      setOnboardingComplete(status.onboardingCompleted);

      if (gate === "inbox" && !status.onboardingCompleted) {
        redirectOnceToDestination(ONBOARDING_PATH, "gate_inbox_requires_onboarding");
        return;
      }

      if (gate === "onboarding" && status.onboardingCompleted) {
        redirectOnceToDestination(INBOX_PATH, "gate_onboarding_already_complete");
        return;
      }

      setGateReady(true);
    })();
  }, [boot, gate]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        logAuthTransition("auth_state_change", { event, status: "unauthenticated" });
        resetBootForSignOut();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo((): AuthResolutionContextValue => {
    const snap = boot;
    return {
      authStatus: snap?.authStatus ?? "loading",
      userId: snap?.userId ?? null,
      userEmail: snap?.userEmail ?? null,
      isAuthenticated: snap?.authStatus === "authenticated",
      bootReady: Boolean(snap?.ready && gateReady),
      onboardingComplete,
    };
  }, [boot, gateReady, onboardingComplete]);

  if (!boot?.ready || !gateReady) {
    return (
      <InboxLoadingState
        locale={locale}
        message={locale === "it" ? "Un momento…" : "One moment…"}
      />
    );
  }

  return (
    <AuthResolutionContext.Provider value={value}>{children}</AuthResolutionContext.Provider>
  );
}
