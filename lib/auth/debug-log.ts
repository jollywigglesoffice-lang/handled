export const AUTH_DEBUG_ENABLED =
  process.env.AUTH_DEBUG === "1" || process.env.NEXT_PUBLIC_AUTH_DEBUG === "1";

export type AuthDebugSnapshot = {
  path: string;
  host: string | null;
  hasCookieHeader: boolean;
  cookieCount: number;
  supabaseAuthCookieNames: string[];
  hasAuthorization: boolean;
  hasProviderHeader: boolean;
  cookieUserId: string | null;
  cookieUserError: string | null;
  bearerUserId: string | null;
  bearerUserError: string | null;
  sessionUserId: string | null;
  hasProviderToken: boolean;
  authSource: "cookie" | "bearer" | null;
  failureReason: string | null;
  /** Middleware-only: why the request was allowed or redirected. */
  redirectDecision?: string;
  onboardingCompleted?: boolean;
};

export function logAuthDebug(label: string, snapshot: Partial<AuthDebugSnapshot>): void {
  if (!AUTH_DEBUG_ENABLED) return;
  console.log(`[auth-debug] ${label}`, JSON.stringify(snapshot));
}
