"use client";

import { useState } from "react";
import { GoogleSignInButton, WelcomeLanding } from "@/app/components/welcome-landing";
import { startGoogleOAuth } from "@/lib/auth/start-google-oauth";

export function BetaLandingPage() {
  const [oauthLoading, setOauthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  async function handleGoogleSignIn() {
    setAuthError("");
    setOauthLoading(true);
    try {
      const { error } = await startGoogleOAuth("/emails");
      if (error) setAuthError(error);
    } catch {
      setAuthError("Could not start Google sign-in. Please try again.");
    } finally {
      setOauthLoading(false);
    }
  }

  return (
    <WelcomeLanding>
      {authError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {authError}
        </p>
      ) : null}
      <GoogleSignInButton onClick={() => void handleGoogleSignIn()} loading={oauthLoading} />
    </WelcomeLanding>
  );
}
