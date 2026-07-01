"use client";

import { Suspense, useEffect, useRef } from "react";
import { AuthCallbackLoading } from "@/app/components/auth-callback-loading";
import { POST_LOGIN_DESTINATION } from "@/lib/auth/post-login-destination";
import { supabaseBrowser } from "@/lib/supabase-browser";

function parseHashTokens(): { access_token: string; refresh_token: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const access_token = params.get("access_token") ?? "";
  const refresh_token = params.get("refresh_token") ?? "";
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

/** Hash-only OAuth fallback — set session then ONE redirect to inbox. */
function AuthCallbackClientContent() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const fromHash = parseHashTokens();
    if (!fromHash) return;

    void supabaseBrowser.auth
      .setSession({
        access_token: fromHash.access_token,
        refresh_token: fromHash.refresh_token,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[auth/callback/client] setSession from hash", error);
          return;
        }
        window.location.replace(POST_LOGIN_DESTINATION);
      });
  }, []);

  return <AuthCallbackLoading />;
}

export default function AuthCallbackClientPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackClientContent />
    </Suspense>
  );
}
