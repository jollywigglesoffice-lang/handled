/** Marketing and auth entry — never require a session. */
export const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/auth/",
  "/success",
  "/cancel",
] as const;

/** OAuth / session bootstrap — middleware must never redirect these. */
export const AUTH_FLOW_PATH_PREFIXES = [
  "/auth/",
  "/login",
  "/api/auth/",
] as const;

export const PUBLIC_EXACT_PATHS = new Set(["/"]);

export const APP_PATH_PREFIXES = ["/app", "/emails", "/inbox", "/settings"] as const;

export function isAuthFlowPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  return AUTH_FLOW_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

export function isAppPath(pathname: string): boolean {
  return APP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function buildLoginRedirectUrl(requestUrl: URL, pathname: string): URL {
  const login = new URL("/login", requestUrl);
  login.searchParams.set("next", pathname);
  return login;
}
