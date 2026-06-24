import { logOnboardingCompletionState } from "@/lib/onboarding/completion-log";
import { normalizeOnboardingCompleted } from "@/lib/onboarding/completion-store";

const COMPLETE_KEY = "handled_guided_onboarding_v2_complete";
const LEGACY_COMPLETE_KEY = "handled_first_onboarding_complete_v1";

type CompletionCacheEntry = {
  completed: boolean;
  source: string;
  hydratedAt: number;
};

const completionByUser = new Map<string, CompletionCacheEntry>();
const hydratePromises = new Map<string, Promise<boolean>>();

function userCompleteKey(userId: string): string {
  return `${COMPLETE_KEY}_${userId}`;
}

function readLocalMirror(userId: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem(userCompleteKey(userId)) === "1") return true;
    return null;
  } catch {
    return null;
  }
}

function writeLocalMirror(userId: string, completed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (completed) {
      localStorage.setItem(userCompleteKey(userId), "1");
    } else {
      localStorage.removeItem(userCompleteKey(userId));
    }
    localStorage.removeItem(COMPLETE_KEY);
    localStorage.removeItem(LEGACY_COMPLETE_KEY);
  } catch {
    /* private mode */
  }
}

function clearLocalMirror(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.removeItem(userCompleteKey(userId));
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${COMPLETE_KEY}_`)) keysToRemove.push(key);
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem(COMPLETE_KEY);
    localStorage.removeItem(LEGACY_COMPLETE_KEY);
  } catch {
    /* private mode */
  }
}

function setCache(userId: string, completed: boolean, source: string): boolean {
  completionByUser.set(userId, {
    completed,
    source,
    hydratedAt: Date.now(),
  });
  writeLocalMirror(userId, completed);
  return completed;
}

export function clearOnboardingCompletionCache(userId?: string | null): void {
  if (userId) {
    completionByUser.delete(userId);
    hydratePromises.delete(userId);
    clearLocalMirror(userId);
    return;
  }
  completionByUser.clear();
  hydratePromises.clear();
  clearLocalMirror(null);
}

/** Safe sync read — defaults to false when unknown (never assumes complete). */
export function isFirstOnboardingComplete(userId?: string | null): boolean {
  if (!userId) return false;
  const cached = completionByUser.get(userId);
  if (cached) return cached.completed === true;
  return false;
}

export function isOnboardingCompletionHydrated(userId: string): boolean {
  return completionByUser.has(userId);
}

export async function hydrateOnboardingCompletionFromServer(
  userId: string,
  authStatus: "authenticated" | "unauthenticated" = "authenticated",
): Promise<boolean> {
  const existing = hydratePromises.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch("/api/onboarding/status", {
        credentials: "include",
        cache: "no-store",
      });

      const body = (await res.json().catch(() => ({}))) as {
        onboardingCompleted?: unknown;
        source?: string;
        rawValue?: boolean | null;
        authenticated?: boolean;
        sessionPresent?: boolean;
      };

      const completed = normalizeOnboardingCompleted(body.onboardingCompleted);

      logOnboardingCompletionState({
        scope: "client",
        userId,
        authStatus,
        sessionPresent: body.sessionPresent ?? res.ok,
        onboardingCompleted: completed,
        source: body.source ?? (res.ok ? "api" : "api_error_default_false"),
        rawValue:
          body.rawValue ??
          (body.onboardingCompleted === true
            ? true
            : body.onboardingCompleted === false
              ? false
              : null),
      });

      return setCache(userId, completed, body.source ?? "api");
    } catch (error) {
      console.error("[onboarding-completion] hydrate failed", error);
      logOnboardingCompletionState({
        scope: "client",
        userId,
        authStatus,
        sessionPresent: false,
        onboardingCompleted: false,
        source: "hydrate_error_default_false",
        rawValue: null,
      });
      return setCache(userId, false, "hydrate_error_default_false");
    } finally {
      hydratePromises.delete(userId);
    }
  })();

  hydratePromises.set(userId, promise);
  return promise;
}

export async function markFirstOnboardingComplete(userId: string): Promise<boolean> {
  setCache(userId, true, "optimistic_local");
  try {
    const res = await fetch("/api/onboarding/status", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      onboardingCompleted?: unknown;
      source?: string;
    };
    if (!res.ok) {
      console.error("[onboarding-completion] mark complete failed", body);
      return false;
    }
    const completed = normalizeOnboardingCompleted(body.onboardingCompleted);
    setCache(userId, completed, body.source ?? "api_post");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("handled-first-onboarding-complete"));
    }
    return completed;
  } catch (error) {
    console.error("[onboarding-completion] mark complete error", error);
    return false;
  }
}

export async function clearFirstOnboardingCompleteOnServer(userId: string): Promise<void> {
  clearOnboardingCompletionCache(userId);
  try {
    await fetch("/api/onboarding/status?resetOnboarding=true", {
      method: "DELETE",
      credentials: "include",
    });
  } catch (error) {
    console.error("[onboarding-completion] server reset failed", error);
  }
}

export function clearFirstOnboardingComplete(userId?: string | null): void {
  clearOnboardingCompletionCache(userId);
}

export const FIRST_ONBOARDING_COMPLETE_EVENT = "handled-first-onboarding-complete";
