"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { saveGoogleProviderToken } from "@/lib/google-provider-token";

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
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      try {
        const code = searchParams.get("code");

        // PKCE ?code= is exchanged in middleware (sets httpOnly cookies for SSR).
        if (code) {
          setStatus("Completing sign-in…");
          await new Promise((r) => setTimeout(r, 150));
        } else {
          const fromHash = parseHashTokens();
          if (fromHash) {
            setStatus("Completing sign-in…");
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
            setStatus("Completing sign-in…");
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
          router.replace("/emails");
        }
      } catch (e) {
        console.error("[auth/callback] unexpected", e);
        if (!cancelled) router.replace("/login?error=oauth");
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
          <p className="text-sm text-gray-500">Signing you in…</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
