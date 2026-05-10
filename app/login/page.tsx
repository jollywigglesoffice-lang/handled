"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

/** Google OAuth must return to production only (no localhost / preview URLs). */
const PRODUCTION_AUTH_ORIGIN = "https://handledemails.com";

export default function LoginPage() {
  const router = useRouter();
  const next =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next") || "/emails"
      : "/emails";

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      // Next.js router can drop the hash; full navigation preserves OAuth tokens.
      window.location.replace(`${window.location.origin}/auth/callback${hash}`);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "oauth") return;

    void (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (data.session) {
        setAuthError("");
        params.delete("error");
        const qs = params.toString();
        const path = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
        window.history.replaceState(null, "", path);
        router.replace("/emails");
        return;
      }
      setAuthError("Google sign-in didn’t complete. Please try again.");
    })();
  }, [router]);

  async function handleGoogleSignIn() {
    setAuthError("");
    setAuthNotice("");
    setOauthLoading(true);

    try {
      const redirectTo = `${PRODUCTION_AUTH_ORIGIN}/auth/callback?next=${encodeURIComponent("/emails")}`;

      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        console.error("Google OAuth error", error);
        setAuthError(error.message);
      }
    } catch (error) {
      console.error("Google OAuth failed", error);
      setAuthError("Could not start Google sign-in. Please try again.");
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleAuthSubmit() {
    setAuthError("");
    setAuthNotice("");

    if (!authEmail || !authPassword) {
      setAuthError("Enter your email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");

      if (authMode === "signup") {
        const result = await supabaseBrowser.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            emailRedirectTo: `${appUrl}/auth/confirmed`,
          },
        });

        if (result.error) {
          console.error("signup error", result.error);
          setAuthError(result.error.message);
          return;
        }

        const newUser = result.data.user;
        const session = result.data.session;
        if (newUser?.id && session) {
          try {
            await fetch("/api/create-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: newUser.id,
                email: newUser.email ?? "",
              }),
            });
          } catch (syncError) {
            console.error("sync public user after signup failed", syncError);
          }
        }

        setAuthPassword("");
        setAuthNotice(
          "Account created! Please check your email to confirm your account. After confirming, come back here and sign in."
        );
        return;
      }

      const result = await supabaseBrowser.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (result.error) {
        console.error("login error", result.error);

        if (result.error.message.includes("Failed to fetch")) {
          setAuthError("Could not connect to authentication. Please refresh and try again.");
        } else {
          setAuthError(result.error.message);
        }

        return;
      }

      const signedInUser = result.data.user;
      if (signedInUser?.id) {
        try {
          await fetch("/api/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: signedInUser.id,
              email: signedInUser.email ?? "",
            }),
          });
        } catch (syncError) {
          console.error("sync public user after login failed", syncError);
        }
      }

      window.location.href = next;
    } catch (error) {
      console.error("auth failed", error);
      setAuthError("Could not connect to authentication. Please refresh and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
            Handled
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            {authMode === "login" ? "Sign in to continue" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Save your replies, preferences, usage, and Pro access across devices.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800">
          🔒 Handled helps draft replies, but never sends emails without your approval.
        </div>

        {authNotice && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold leading-relaxed text-indigo-700">
            {authNotice}
          </div>
        )}

        {authError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-relaxed text-red-700">
            {authError}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={oauthLoading || isSubmitting}
            aria-label="Continue with Google"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {oauthLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 font-medium text-gray-400">or</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 pr-11 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-gray-400 transition hover:text-gray-600"
            >
              {showPassword ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 4.24A10.94 10.94 0 0112 4c5.4 0 9.27 3.11 10.5 8a10.63 10.63 0 01-4.04 5.94M6.61 6.61A10.75 10.75 0 001.5 12a10.94 10.94 0 003.18 5.14"
                  />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M1.5 12S5.4 4 12 4s10.5 8 10.5 8-3.9 8-10.5 8S1.5 12 1.5 12z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleAuthSubmit}
            disabled={isSubmitting || oauthLoading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSubmitting
              ? "Please wait..."
              : authMode === "login"
              ? "Sign in"
              : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthError("");
              setAuthNotice("");
              setAuthMode(authMode === "login" ? "signup" : "login");
            }}
            disabled={oauthLoading}
            className="w-full text-xs font-medium text-gray-400 hover:text-gray-600 disabled:opacity-60"
          >
            {authMode === "login"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}
