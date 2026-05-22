/** Canonical app origin for redirects and OAuth (production vs local dev). */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv?.startsWith("http")) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "https://handledemails.com";
}

/** Google OAuth redirect origin: localhost in dev, production otherwise. */
export function getOAuthRedirectOrigin(): string {
  if (process.env.NODE_ENV === "development") {
    return getAppOrigin();
  }
  return "https://handledemails.com";
}

export function buildLoginUrl(nextPath?: string): string {
  const next = nextPath?.startsWith("/") ? nextPath : "/emails";
  return `/login?next=${encodeURIComponent(next)}`;
}
