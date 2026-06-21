"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { calmLoadingMessages } from "@/lib/calm-system-copy";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { saveGoogleProviderToken } from "@/lib/google-provider-token";
import { completeAttachInboxFromCallback } from "@/lib/gmail/connect-account-client";

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

function AuthCallbackContent() {
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
        const next =
          nextParam?.startsWith("/")
            ? nextParam
            : isAttachFlow
              ? "/emails?inbox_added=1"
              : "/emails";

        const code = searchParams.get("code");

        if (code) {
          setStatus(LOADING_EN[0] ?? defaultLoadingStatus());
          const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[auth/callback] exchangeCodeForSession", error);
            if (!cancelled) {
              router.replace(
                isAttachFlow ? "/emails?attach_error=oauth" : "/login?error=oauth",
              );
            }
            return;
          }
        } else if (!isAttachFlow) {
          const fromHash = parseHashTokens();
          if (fromHash) {
            setStatus(LOADING_EN[0] ?? defaultLoadingStatus());
            const { error } = await supabaseBrowser.auth.setSession({
              access_token: fromHash.access_token,
              refresh_token: fromHash.refresh_token,
            });
            if (error) {
              console.error("[auth/callback] setSession from hash", error);
              if (!cancelled) router.replace("/login?error=oauth");
              return;
            }
          } else {
            setStatus(LOADING_EN[0] ?? defaultLoadingStatus());
            await new Promise((r) => setTimeout(r, 100));
            const { data, error } = await supabaseBrowser.auth.getSession();
            if (error) {
              console.error("[auth/callback] getSession", error);
            }
            if (!data.session) {
              await new Promise((r) => setTimeout(r, 200));
              const retry = await supabaseBrowser.auth.getSession();
              if (!retry.data.session) {
                if (!cancelled) router.replace("/login?error=oauth");
                return;
              }
            }
          }
        } else {
          await new Promise((r) => setTimeout(r, 150));
        }

        if (isAttachFlow) {
          setStatus("Bringing your inbox into focus…");
          const result = await completeAttachInboxFromCallback(next);
          if (!cancelled) {
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/auth/callback");
            }
            if (!result.ok) {
              router.replace(
                `/emails?attach_error=${encodeURIComponent(result.message ?? "attach_failed")}`,
              );
              return;
            }
            const dest = next.includes("inbox_added")
              ? next
              : `${next}${next.includes("?") ? "&" : "?"}inbox_added=1`;
            router.replace(dest);
          }
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
          console.error("[auth/callback] persist Google tokens failed", persistError);
        }

        await fetch("/api/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session.user.id,
            email: session.user.email ?? "",
          }),
        });

        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/auth/callback");
        }

        if (!cancelled) {
          router.replace(next);
        }
      } catch (e) {
        console.error("[auth/callback] unexpected", e);
        const attach = searchParams.get("attach");
        const isAttachFlow = attach === "true" || attach === "1";
        if (!cancelled) {
          router.replace(
            isAttachFlow ? "/emails?attach_error=unexpected" : "/login?error=oauth",
          );
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

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
          <p className="text-sm text-gray-500">{defaultLoadingStatus()}</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
