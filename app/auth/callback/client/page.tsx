"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCallbackLoading } from "@/app/components/auth-callback-loading";
import { completeBootAfterAuth } from "@/lib/auth/boot-controller";
import { runPostAuthSideEffects } from "@/lib/auth/post-auth-side-effects";
import { waitForAuthenticatedSession } from "@/lib/auth/session-hydration";
import { completeAttachInboxFromCallback } from "@/lib/gmail/connect-account-client";
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

function AuthCallbackClientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      try {
        const attach = searchParams.get("attach");
        const isAttachFlow = attach === "true" || attach === "1";
        const nextParam = searchParams.get("next");
        const attachNext = nextParam?.startsWith("/") ? nextParam : null;
        const next = isAttachFlow
          ? attachNext
          : nextParam?.startsWith("/")
            ? nextParam
            : null;

        const fromHash = parseHashTokens();
        if (fromHash) {
          const { error: setSessionError } = await supabaseBrowser.auth.setSession({
            access_token: fromHash.access_token,
            refresh_token: fromHash.refresh_token,
          });
          if (setSessionError) {
            console.error("[auth/callback/client] setSession from hash", setSessionError);
            if (!cancelled) router.replace("/login?error=oauth");
            return;
          }
        }

        const session = await waitForAuthenticatedSession("oauth_callback");
        if (cancelled) return;

        if (!session.ok || !session.userId) {
          router.replace("/login?error=oauth");
          return;
        }

        if (isAttachFlow) {
          const result = await completeAttachInboxFromCallback();
          if (cancelled) return;

          if (!result.ok) {
            window.location.replace(
              `/login?attach_error=${encodeURIComponent(result.message ?? "attach_failed")}`,
            );
            return;
          }

          const dest = attachNext
            ? attachNext.includes("inbox_added")
              ? attachNext
              : `${attachNext}${attachNext.includes("?") ? "&" : "?"}inbox_added=1`
            : null;
          await completeBootAfterAuth(dest);
          return;
        }

        runPostAuthSideEffects(session.userId, session.email);
        await completeBootAfterAuth(next);
      } catch (e) {
        console.error("[auth/callback/client] unexpected", e);
        if (!cancelled) {
          const attach = searchParams.get("attach");
          const isAttachFlow = attach === "true" || attach === "1";
          if (isAttachFlow) {
            window.location.replace("/login?attach_error=unexpected");
          } else {
            router.replace("/login?error=oauth");
          }
        }
      }
    }

    void finishAuth();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return <AuthCallbackLoading />;
}

export default function AuthCallbackClientPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackClientContent />
    </Suspense>
  );
}
