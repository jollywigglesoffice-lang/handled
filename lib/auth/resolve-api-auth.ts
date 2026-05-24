import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  getServerAuthSessionFromClient,
  type ServerAuthSession,
} from "@/lib/auth/server-session";
import {
  AUTH_DEBUG_ENABLED,
  logAuthDebug,
  type AuthDebugSnapshot,
} from "@/lib/auth/debug-log";
import {
  listSupabaseAuthCookieNames,
  readRequestCookieEntries,
} from "@/lib/auth/request-cookies";

export const HANDLED_PROVIDER_TOKEN_HEADER = "x-handled-provider-token";

export type ResolvedApiAuth = ServerAuthSession & {
  source: "cookie" | "bearer";
};

function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

function providerTokenFromHeader(request: Request): string | null {
  const token = request.headers.get(HANDLED_PROVIDER_TOKEN_HEADER)?.trim();
  return token || null;
}

function augmentProviderToken(
  auth: ServerAuthSession,
  request: Request,
): ServerAuthSession {
  if (auth.providerToken) return auth;
  const fromHeader = providerTokenFromHeader(request);
  if (!fromHeader) return auth;
  return { ...auth, providerToken: fromHeader };
}

function minimalSession(user: User, accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: "",
    expires_in: 0,
    token_type: "bearer",
    user,
  } as Session;
}

export function buildAuthDebugSnapshot(request: Request): Omit<
  AuthDebugSnapshot,
  | "cookieUserId"
  | "cookieUserError"
  | "bearerUserId"
  | "bearerUserError"
  | "sessionUserId"
  | "hasProviderToken"
  | "authSource"
  | "failureReason"
> {
  const entries = readRequestCookieEntries(request);
  return {
    path: new URL(request.url).pathname,
    host: request.headers.get("host"),
    hasCookieHeader: Boolean(request.headers.get("cookie")),
    cookieCount: entries.length,
    supabaseAuthCookieNames: listSupabaseAuthCookieNames(entries),
    hasAuthorization: Boolean(parseBearerToken(request)),
    hasProviderHeader: Boolean(providerTokenFromHeader(request)),
  };
}

/**
 * Resolve authenticated user for API routes: cookies first, then Bearer JWT.
 * Google provider_token comes from session cookies or X-Handled-Provider-Token.
 */
export async function resolveApiAuth(
  request: Request,
  supabase: SupabaseClient,
): Promise<{ auth: ResolvedApiAuth | null; debug: AuthDebugSnapshot }> {
  const base = buildAuthDebugSnapshot(request);
  const debug: AuthDebugSnapshot = {
    ...base,
    cookieUserId: null,
    cookieUserError: null,
    bearerUserId: null,
    bearerUserError: null,
    sessionUserId: null,
    hasProviderToken: false,
    authSource: null,
    failureReason: null,
  };

  const {
    data: { user: cookieUser },
    error: cookieUserError,
  } = await supabase.auth.getUser();

  if (cookieUserError) {
    debug.cookieUserError = cookieUserError.message;
  }
  if (cookieUser?.id) {
    debug.cookieUserId = cookieUser.id;
  }

  if (cookieUser?.id) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const auth = augmentProviderToken(
        {
          user: cookieUser,
          session,
          providerToken: session.provider_token ?? null,
        },
        request,
      );
      debug.sessionUserId = session.user.id;
      debug.hasProviderToken = Boolean(auth.providerToken);
      debug.authSource = "cookie";
      logAuthDebug("ok-cookie", debug);
      return { auth: { ...auth, source: "cookie" }, debug };
    }
    debug.failureReason = "getUser succeeded but getSession missing (stale or chunked cookies)";
  } else if (!parseBearerToken(request)) {
    debug.failureReason = cookieUserError?.message ?? "no_supabase_auth_cookies";
  }

  const bearer = parseBearerToken(request);
  if (bearer) {
    const {
      data: { user: bearerUser },
      error: bearerUserError,
    } = await supabase.auth.getUser(bearer);

    if (bearerUserError) {
      debug.bearerUserError = bearerUserError.message;
    }
    if (bearerUser?.id) {
      debug.bearerUserId = bearerUser.id;
      const providerToken = providerTokenFromHeader(request);
      const auth: ResolvedApiAuth = {
        user: bearerUser,
        session: minimalSession(bearerUser, bearer),
        providerToken,
        source: "bearer",
      };
      debug.sessionUserId = bearerUser.id;
      debug.hasProviderToken = Boolean(providerToken);
      debug.authSource = "bearer";
      debug.failureReason = null;
      logAuthDebug("ok-bearer", debug);
      return { auth, debug };
    }
    debug.failureReason = bearerUserError?.message ?? "bearer_jwt_invalid";
  }

  if (!debug.failureReason) {
    debug.failureReason = "unauthorized";
  }

  logAuthDebug("failed", debug);

  if (AUTH_DEBUG_ENABLED) {
    console.log("[auth-debug] cookie names on request", base.supabaseAuthCookieNames);
  }

  return { auth: null, debug };
}
