import { saveGoogleProviderToken } from "@/lib/google-provider-token";
import { logSessionHydration } from "@/lib/auth/session-hydration";
import { supabaseBrowser } from "@/lib/supabase-browser";

/** Non-blocking post-auth setup — must not delay OAuth redirect. */
export function runPostAuthSideEffects(userId: string, email: string | null): void {
  void (async () => {
    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (session?.provider_token) {
        saveGoogleProviderToken(session.provider_token);
      }

      const tasks: Promise<unknown>[] = [
        fetch("/api/auth/persist-google-tokens", {
          method: "POST",
          credentials: "include",
        }),
        fetch("/api/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            email: email ?? "",
          }),
        }),
      ];

      const results = await Promise.allSettled(tasks);
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("[post-auth-side-effects] task failed", result.reason);
        }
      }

      logSessionHydration("side_effects_complete", { userId });
    } catch (error) {
      console.error("[post-auth-side-effects] unexpected", error);
    }
  })();
}
