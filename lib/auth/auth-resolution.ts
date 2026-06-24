import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  logSessionHydration,
  waitForAuthenticatedSession,
  type SessionHydrationResult,
} from "@/lib/auth/session-hydration";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthResolutionResult = {
  status: Exclude<AuthStatus, "loading">;
  userId: string | null;
  email: string | null;
  resolutionMs: number;
};

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

function fromHydration(result: SessionHydrationResult): AuthResolutionResult {
  if (result.ok && result.userId) {
    return {
      status: "authenticated",
      userId: result.userId,
      email: result.email,
      resolutionMs: result.resolutionMs,
    };
  }
  return {
    status: "unauthenticated",
    userId: null,
    email: null,
    resolutionMs: result.resolutionMs,
  };
}

/** Resolve client auth once — retries until session is fully hydrated. */
export async function resolveClientAuth(
  reason = "boot",
): Promise<AuthResolutionResult> {
  const hydration = await waitForAuthenticatedSession(reason);
  const result = fromHydration(hydration);
  logAuthTransition("session_resolved", {
    status: result.status,
    userId: result.userId,
    resolutionMs: result.resolutionMs,
    attempts: hydration.attempts,
    reason,
  });
  return result;
}

export { waitForAuthenticatedSession, logSessionHydration };
