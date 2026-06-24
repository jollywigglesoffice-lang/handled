"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { calmLoadingMessages } from "@/lib/calm-system-copy";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { saveGoogleProviderToken } from "@/lib/google-provider-token";
import { completeAttachInboxFromCallback } from "@/lib/gmail/connect-account-client";
import { completeBootAfterAuth } from "@/lib/auth/boot-controller";
import { InboxLoadingState } from "@/app/emails/inbox-loading-state";

const LOADING_EN = calmLoadingMessages("en");

function defaultLoadingStatus(): string {
  return LOADING_EN[0] ?? "Just a moment…";
}

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

async function waitForSession(maxAttempts = 5): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabaseBrowser.auth.getSession();
    if (error) {
      console.error("[auth/callback/client] getSession", error);
    }
    if (data.session?.user) return true;
    await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
  }
  return false;
}

function AuthCallbackClientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(defaultLoadingStatus);

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
          setStatus(LOADING_EN[0] ?? defaultLoadingStatus());
          const { error } = await supabaseBrowser.auth.setSession({
            access_token: fromHash.access_token,
            refresh_token: fromHash.refresh_token,
          });
          if (error) {
            console.error("[auth/callback/client] setSession from hash", error);
            if (!cancelled) router.replace("/login?error=oauth");
            return;
          }
        } else if (!isAttachFlow) {
          setStatus(LOADING_EN[0] ?? defaultLoadingStatus());
          const ready = await waitForSession();
          if (!ready && !cancelled) {
            router.replace("/login?error=oauth");
            return;
          }
        } else {
          await new Promise((r) => setTimeout(r, 150));
        }

        if (isAttachFlow) {
          setStatus("Bringing your inbox into focus…");
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

        const {
          data: { session },
        } = await supabaseBrowser.auth.getSession();

        if (!session?.user) {
          if (!cancelled) router.replace("/login?error=oauth");
          return;
        }

        if (session.provider_token) {
          saveGoogleProviderToken(session.provider_token);
        }

        try {
          await fetch("/api/auth/persist-google-tokens", {
            method: "POST",
            credentials: "include",
          });
        } catch (persistError) {
          console.error("[auth/callback/client] persist Google tokens failed", persistError);
        }

        try {
          await fetch("/api/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: session.user.id,
              email: session.user.email ?? "",
            }),
          });
        } catch (syncError) {
          console.error("[auth/callback/client] create-user failed", syncError);
        }

        if (!cancelled) {
          await completeBootAfterAuth(next);
        }
      } catch (e) {
        console.error("[auth/callback/client] unexpected", e);
        const attach = searchParams.get("attach");
        const isAttachFlow = attach === "true" || attach === "1";
        if (!cancelled) {
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <p className="text-sm text-gray-500">{status}</p>
    </main>
  );
}

export default function AuthCallbackClientPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
          <InboxLoadingState locale="en" />
        </main>
      }
    >
      <AuthCallbackClientContent />
    </Suspense>
  );
}
