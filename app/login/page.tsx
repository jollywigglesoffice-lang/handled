"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const next =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next") || "/emails"
      : "/emails";

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

        <div className="space-y-2">
          <input
            type="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />

          <input
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={handleAuthSubmit}
            disabled={isSubmitting}
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
            className="w-full text-xs font-medium text-gray-400 hover:text-gray-600"
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
