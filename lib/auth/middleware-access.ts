import {
  AUTH_FLOW_PATH_PREFIXES,
  isAppPath,
  isAuthFlowPath,
  isPublicPath,
} from "@/lib/auth/route-access";

/** Webhooks and other routes that must never touch Supabase session refresh. */
export const MIDDLEWARE_AUTH_SKIP_PREFIXES = ["/api/stripe-webhook"] as const;

export type MiddlewareAuthSkipReason =
  | "stripe_webhook"
  | "auth_flow"
  | "public_path";

export function getMiddlewareAuthSkipReason(pathname: string): MiddlewareAuthSkipReason | null {
  if (MIDDLEWARE_AUTH_SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "stripe_webhook";
  }
  if (isAuthFlowPath(pathname)) {
    return "auth_flow";
  }
  if (isPublicPath(pathname)) {
    return "public_path";
  }
  return null;
}

export function shouldSkipMiddlewareAuth(pathname: string): boolean {
  return getMiddlewareAuthSkipReason(pathname) !== null;
}

export { isAppPath, isAuthFlowPath, isPublicPath };
