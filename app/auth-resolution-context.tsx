"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AuthStatus } from "@/lib/auth/auth-resolution";
import { logAuthTransition } from "@/lib/auth/auth-resolution";
import { resetBootForSignOut, runBoot, type BootSnapshot } from "@/lib/auth/boot-controller";
import { InboxLoadingState } from "@/app/emails/inbox-loading-state";

export type AuthResolutionContextValue = {
  authStatus: AuthStatus;
  userId: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;
  bootReady: boolean;
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

type AuthResolutionProviderProps = {
  children: ReactNode;
  mode: "app" | "login";
  locale?: "en" | "it";
};

/**
 * Resolves auth once — loading screen until ready.
 * NO client redirects (middleware handles unauthenticated app access).
 */
export function AuthResolutionProvider({
  children,
  mode,
  locale = "en",
}: AuthResolutionProviderProps) {
  const [boot, setBoot] = useState<BootSnapshot | null>(null);

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
      bootReady: Boolean(snap?.ready),
    };
  }, [boot]);

  if (!boot?.ready) {
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
