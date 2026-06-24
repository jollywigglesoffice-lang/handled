"use client";

import { useState } from "react";
import { GoogleSignInButton, WelcomeLanding } from "@/app/components/welcome-landing";
import { useUiCopy } from "@/app/use-ui-copy";
import { startGoogleOAuth } from "@/lib/auth/start-google-oauth";

export function BetaLandingPage() {
  const ui = useUiCopy();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  async function handleGoogleSignIn() {
    setAuthError("");
    setOauthLoading(true);
    try {
      const { error } = await startGoogleOAuth("/onboarding");
      if (error) setAuthError(ui.auth.oauthFailed);
    } catch {
      setAuthError(ui.auth.oauthFailed);
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
