import { supabaseBrowser } from "@/lib/supabase-browser";
import { logAuthTransition } from "@/lib/auth/auth-resolution";

export type SessionHydrationResult = {
  ok: boolean;
  userId: string | null;
  email: string | null;
  attempts: number;
  resolutionMs: number;
  reason: string;
};

const DEVELOPMENT_DELAYS_MS = [0, 80, 160, 280, 450, 650];
const PRODUCTION_DELAYS_MS = [0, 100, 200, 350, 500, 750, 1000, 1300, 1700, 2200];

function hydrationDelays(): number[] {
  if (process.env.NODE_ENV === "production") return PRODUCTION_DELAYS_MS;
  return DEVELOPMENT_DELAYS_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Always log session hydration — critical for production OAuth debugging. */
export function logSessionHydration(
  event: string,
  detail: Record<string, unknown>,
): void {
  const payload = {
    event,
    environment: process.env.NODE_ENV ?? "production",
    ...detail,
    at: Date.now(),
  };
  console.log("[session-hydration]", payload);
  logAuthTransition("session_hydration", payload);
}

/**
 * Wait until Supabase session is fully available in the browser.
 * Uses getUser() (validates JWT) plus getSession() (access token present).
 */
export async function waitForAuthenticatedSession(
  reason = "client_hydration",
): Promise<SessionHydrationResult> {
  const started = Date.now();
  const delays = hydrationDelays();

  logSessionHydration("wait_start", { reason, maxAttempts: delays.length });

  for (let attempt = 0; attempt < delays.length; attempt++) {
    const delay = delays[attempt];
    if (delay > 0) {
      await sleep(delay);
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseBrowser.auth.getUser();

    if (userError) {
      logSessionHydration("probe_error", {
        reason,
        attempt,
        message: userError.message,
        elapsedMs: Date.now() - started,
      });
    }

    if (user?.id) {
      const {
        data: { session },
        error: sessionError,
      } = await supabaseBrowser.auth.getSession();

      if (sessionError) {
        logSessionHydration("session_probe_error", {
          reason,
          attempt,
          message: sessionError.message,
          userId: user.id,
          elapsedMs: Date.now() - started,
        });
      }

      if (session?.access_token) {
        const result: SessionHydrationResult = {
          ok: true,
          userId: user.id,
          email: user.email ?? null,
          attempts: attempt + 1,
          resolutionMs: Date.now() - started,
          reason,
        };
        logSessionHydration("wait_success", result);
        return result;
      }
    }
  }

  const result: SessionHydrationResult = {
    ok: false,
    userId: null,
    email: null,
    attempts: delays.length,
    resolutionMs: Date.now() - started,
    reason,
  };
  logSessionHydration("wait_failed", result);
  return result;
}
