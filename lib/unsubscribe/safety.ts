const BLOCKED_PROTOCOLS = /^(javascript|data|vbscript|file):/i;
const IP_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;
const SUSPICIOUS_TLDS = /\.(zip|exe|mov|apk|scr|lnk)$/i;

/** Known URL shorteners — require extra caution (still allow with confirmation). */
const SHORTENERS =
  /(^|\.)((bit\.ly)|(t\.co)|(goo\.gl)|(tinyurl\.com)|(ow\.ly)|(buff\.ly)|(is\.gd)|(rb\.gy))$/i;

export type UrlSafetyResult = {
  safe: boolean;
  caution: boolean;
  reason?: string;
};

export function assessUnsubscribeUrlSafety(url: string): UrlSafetyResult {
  const trimmed = url.trim();
  if (!trimmed) {
    return { safe: false, caution: false, reason: "empty" };
  }

  if (BLOCKED_PROTOCOLS.test(trimmed)) {
    return { safe: false, caution: false, reason: "blocked_protocol" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, caution: false, reason: "invalid_url" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { safe: false, caution: false, reason: "unsupported_protocol" };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || host.length < 3) {
    return { safe: false, caution: false, reason: "invalid_host" };
  }

  if (IP_HOST.test(host)) {
    return { safe: false, caution: false, reason: "ip_host" };
  }

  if (host.includes("..") || host.startsWith("-")) {
    return { safe: false, caution: false, reason: "malformed_host" };
  }

  const full = parsed.href.toLowerCase();
  if (SUSPICIOUS_TLDS.test(full)) {
    return { safe: false, caution: false, reason: "suspicious_extension" };
  }

  if (parsed.protocol === "http:") {
    return { safe: false, caution: true, reason: "http_not_https" };
  }

  if (SHORTENERS.test(host)) {
    return { safe: false, caution: true, reason: "url_shortener" };
  }

  if (!/unsub|opt-?out|remove|preferences|manage|list-manage|email-preferences/i.test(full)) {
    return { safe: false, caution: true, reason: "url_pattern_mismatch" };
  }

  return { safe: true, caution: false };
}
