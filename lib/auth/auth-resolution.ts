import { supabaseBrowser } from "@/lib/supabase-browser";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthResolutionResult = {
  status: Exclude<AuthStatus, "loading">;
  userId: string | null;
  email: string | null;
  resolutionMs: number;
};

const RESOLUTION_DELAYS_MS = [0, 100, 220, 400, 650];

export function logAuthTransition(
  event: string,
  detail: Record<string, unknown>,
): void {
  const enabled =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_AUTH_DEBUG === "1" ||
    process.env.AUTH_DEBUG === "1";
  if (!enabled) return;
  console.log("[auth-transition]", { event, ...detail, at: Date.now() });
}

/** Resolve client auth once — retries briefly after OAuth cookie hydration. */
export async function resolveClientAuth(): Promise<AuthResolutionResult> {
  const started = Date.now();

  for (let attempt = 0; attempt < RESOLUTION_DELAYS_MS.length; attempt++) {
    const delay = RESOLUTION_DELAYS_MS[attempt];
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const {
      data: { user },
      error,
    } = await supabaseBrowser.auth.getUser();

    if (user?.id) {
      const result: AuthResolutionResult = {
        status: "authenticated",
        userId: user.id,
        email: user.email ?? null,
        resolutionMs: Date.now() - started,
      };
      logAuthTransition("session_resolved", {
        status: result.status,
        userId: result.userId,
        attempt,
        resolutionMs: result.resolutionMs,
      });
      return result;
    }

    if (error) {
      logAuthTransition("session_probe_error", {
        attempt,
        message: error.message,
        elapsedMs: Date.now() - started,
      });
    }
  }

  const result: AuthResolutionResult = {
    status: "unauthenticated",
    userId: null,
    email: null,
    resolutionMs: Date.now() - started,
  };
  logAuthTransition("session_resolved", {
    status: result.status,
    resolutionMs: result.resolutionMs,
  });
  return result;
}
