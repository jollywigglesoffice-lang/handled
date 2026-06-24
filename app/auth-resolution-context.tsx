"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AuthStatus } from "@/lib/auth/auth-resolution";
import { logAuthTransition } from "@/lib/auth/auth-resolution";
import {
  executeBootNavigation,
  resetBootForSignOut,
  runBoot,
  type BootSnapshot,
} from "@/lib/auth/boot-controller";
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
  loginNextPath?: string | null;
  locale?: "en" | "it";
};

export function AuthResolutionProvider({
  children,
  mode,
  loginNextPath = null,
  locale = "en",
}: AuthResolutionProviderProps) {
  const pathname = usePathname();
  const [boot, setBoot] = useState<BootSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const snapshot = await runBoot({
        pathname,
        mode,
        requestedNext: mode === "login" ? loginNextPath : null,
      });
      if (cancelled) return;

      if (snapshot.destination && snapshot.destination !== pathname) {
        const navigated = executeBootNavigation(snapshot);
        if (!navigated) {
          window.location.replace(snapshot.destination);
        }
        return;
      }

      setBoot(snapshot);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, mode, loginNextPath]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        logAuthTransition("auth_state_change", { event, status: "unauthenticated" });
        resetBootForSignOut();
        window.location.replace("/login");
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

  const bootPending = !boot || !boot.ready;

  if (bootPending) {
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
