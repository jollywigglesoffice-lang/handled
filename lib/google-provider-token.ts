const GOOGLE_PROVIDER_TOKEN_KEY = "handled-google-provider-token";

export function saveGoogleProviderToken(token: string) {
  if (typeof window === "undefined") return;
  if (!token) return;
  window.localStorage.setItem(GOOGLE_PROVIDER_TOKEN_KEY, token);
}

export function getGoogleProviderToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(GOOGLE_PROVIDER_TOKEN_KEY);
  return token || null;
}
