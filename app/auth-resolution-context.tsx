"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  logAuthTransition,
  resolveClientAuth,
  type AuthStatus,
} from "@/lib/auth/auth-resolution";
import { commitClientRedirect } from "@/lib/auth/client-redirect-lock";
import {
  logPostLoginRouteDecision,
  resolvePostAuthPath,
} from "@/lib/onboarding/route-access";
import { InboxLoadingState } from "@/app/emails/inbox-loading-state";

export type AuthResolutionContextValue = {
  authStatus: AuthStatus;
  userId: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;
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
  /** App routes rely on middleware; login may forward authenticated users. */
  mode: "app" | "login";
  loginNextPath?: string;
  locale?: "en" | "it";
};

export function AuthResolutionProvider({
  children,
  mode,
  loginNextPath = "/emails",
  locale = "en",
}: AuthResolutionProviderProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const resolvedRef = useRef(false);
  const loginForwardRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      logAuthTransition("resolution_start", { mode });
      const result = await resolveClientAuth();
      if (cancelled) return;
      resolvedRef.current = true;
      setAuthStatus(result.status);
      setUserId(result.userId);
      setUserEmail(result.email);
    })();

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (!resolvedRef.current) return;

      if (event === "SIGNED_OUT") {
        logAuthTransition("auth_state_change", { event, status: "unauthenticated" });
        setAuthStatus("unauthenticated");
        setUserId(null);
        setUserEmail(null);
        return;
      }

      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        logAuthTransition("auth_state_change", {
          event,
          status: "authenticated",
          userId: session.user.id,
        });
        setAuthStatus("authenticated");
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [mode]);

  const forwardAuthenticatedFromLogin = useCallback(() => {
    if (mode !== "login" || authStatus !== "authenticated") return;
    if (loginForwardRef.current) return;
    loginForwardRef.current = true;

    const target = resolvePostAuthPath(loginNextPath);
    if (!commitClientRedirect("login_forward_authenticated", target)) return;

    logPostLoginRouteDecision({
      authStatus,
      requestedNext: loginNextPath,
      destination: target,
    });
    window.location.replace(target);
  }, [mode, authStatus, loginNextPath]);

  useEffect(() => {
    forwardAuthenticatedFromLogin();
  }, [forwardAuthenticatedFromLogin]);

  const value = useMemo(
    (): AuthResolutionContextValue => ({
      authStatus,
      userId,
      userEmail,
      isAuthenticated: authStatus === "authenticated",
    }),
    [authStatus, userId, userEmail],
  );

  if (authStatus === "loading") {
    return (
      <InboxLoadingState
        locale={locale}
        message={locale === "it" ? "Un momento…" : "One moment…"}
      />
    );
  }

  if (mode === "login" && authStatus === "authenticated") {
    return (
      <InboxLoadingState
        locale={locale}
        message={
          locale === "it" ? "Ti portiamo alla prossima tappa…" : "Taking you to the next step…"
        }
      />
    );
  }

  if (mode === "app" && authStatus === "unauthenticated") {
    return (
      <AppUnauthenticatedFallback locale={locale} />
    );
  }

  return (
    <AuthResolutionContext.Provider value={value}>{children}</AuthResolutionContext.Provider>
  );
}

function AppUnauthenticatedFallback({ locale }: { locale: "en" | "it" }) {
  useEffect(() => {
    const target = `/login?next=${encodeURIComponent("/emails")}`;
    if (commitClientRedirect("app_unauthenticated_fallback", target)) {
      window.location.replace(target);
    }
  }, []);

  return (
    <InboxLoadingState
      locale={locale}
      message={locale === "it" ? "Reindirizzamento…" : "Redirecting…"}
    />
  );
}
