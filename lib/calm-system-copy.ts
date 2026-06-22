import type { InboxLoadFailureReason } from "@/lib/inbox-load/types";
import {
  voiceEmptyLine,
  voiceEmptyLines,
  voiceInboxLoadError,
  voiceInboxLoadErrorTitle,
  voiceLoadingInbox,
  voiceLoadingTransition,
  voiceTryAgainLabel,
  type VoiceLocale,
} from "@/lib/voice";

/** @deprecated Use VoiceLocale from @/lib/voice */
export type CalmSystemLocale = VoiceLocale;

/** Calm system copy — delegates to the Handled voice identity system. */
export const CALM_LOADING_MESSAGES: Record<CalmSystemLocale, readonly string[]> = {
  en: voiceLoadingInbox("en"),
  it: voiceLoadingInbox("it"),
};

export const CALM_TRANSITION_MESSAGES: Record<CalmSystemLocale, readonly string[]> = {
  en: voiceLoadingTransition("en"),
  it: voiceLoadingTransition("it"),
};

export const CALM_EMPTY_MESSAGES: Record<CalmSystemLocale, readonly string[]> = {
  en: voiceEmptyLines("en"),
  it: voiceEmptyLines("it"),
};

type CalmErrorVariant = "inboxUnreachable" | "tryAgain" | "slippedAway";

const INBOX_FAILURE_VARIANT: Record<InboxLoadFailureReason, CalmErrorVariant> = {
  network_error: "slippedAway",
  timeout: "tryAgain",
  auth_error: "inboxUnreachable",
  missing_account: "inboxUnreachable",
  gmail_fetch_failed: "inboxUnreachable",
  gmail_rate_limit: "tryAgain",
  db_error: "tryAgain",
  server_unavailable: "tryAgain",
  categorization_failure: "slippedAway",
  headers_too_large: "tryAgain",
  unknown: "inboxUnreachable",
};

const SPECIAL_MESSAGES_EN = {
  reconnecting: voiceLoadingTransition("en")[0]!,
  rate_limit_soft: "Catching up — showing your latest mail while things settle.",
  headers_too_large:
    "This didn't work. Sign out and back in — your inbox is saved.",
  searchLoading: "Looking through your mail…",
  loadMore: "Gathering more messages…",
} as const;

const SPECIAL_MESSAGES_IT = {
  reconnecting: voiceLoadingTransition("it")[0]!,
  rate_limit_soft: "Mi metto al passo — mostro l'ultima posta mentre tutto si sistema.",
  headers_too_large:
    "Non ha funzionato. Esci e accedi di nuovo — la inbox è salvata.",
  searchLoading: "Cerco nella tua posta…",
  loadMore: "Raccolgo altri messaggi…",
} as const;

export function calmLoadingMessages(locale: CalmSystemLocale): string[] {
  return [...voiceLoadingInbox(locale)];
}

export function calmTransitionMessages(locale: CalmSystemLocale): string[] {
  return [...voiceLoadingTransition(locale)];
}

export function calmEmptyMessage(locale: CalmSystemLocale, seed = 0): string {
  return voiceEmptyLine(locale, seed);
}

export function calmEmptyMessages(locale: CalmSystemLocale): string[] {
  return [...voiceEmptyLines(locale)];
}

export function calmRetryLabel(locale: CalmSystemLocale): string {
  return voiceTryAgainLabel(locale);
}

export function calmErrorBody(
  variant: CalmErrorVariant,
  locale: CalmSystemLocale = "en",
): string {
  const reason =
    variant === "inboxUnreachable"
      ? "auth_error"
      : variant === "tryAgain"
        ? "timeout"
        : "network_error";
  return voiceInboxLoadError(reason, locale);
}

export function calmErrorTitle(
  variant: CalmErrorVariant,
  locale: CalmSystemLocale = "en",
): string {
  const reason =
    variant === "inboxUnreachable"
      ? "auth_error"
      : variant === "tryAgain"
        ? "timeout"
        : "network_error";
  return voiceInboxLoadErrorTitle(reason, locale);
}

export function calmInboxLoadErrorMessage(
  reason: InboxLoadFailureReason | "reconnecting" | "rate_limit_soft" | "headers_too_large",
  locale: CalmSystemLocale = "en",
): string {
  if (reason === "reconnecting") {
    return locale === "it" ? SPECIAL_MESSAGES_IT.reconnecting : SPECIAL_MESSAGES_EN.reconnecting;
  }
  if (reason === "rate_limit_soft") {
    return locale === "it" ? SPECIAL_MESSAGES_IT.rate_limit_soft : SPECIAL_MESSAGES_EN.rate_limit_soft;
  }
  if (reason === "headers_too_large") {
    return locale === "it" ? SPECIAL_MESSAGES_IT.headers_too_large : SPECIAL_MESSAGES_EN.headers_too_large;
  }
  return voiceInboxLoadError(reason, locale);
}

export function calmInboxLoadErrorTitle(
  reason: InboxLoadFailureReason,
  locale: CalmSystemLocale = "en",
): string {
  return voiceInboxLoadErrorTitle(reason, locale);
}

export function calmSearchLoadingMessage(locale: CalmSystemLocale): string {
  return locale === "it" ? SPECIAL_MESSAGES_IT.searchLoading : SPECIAL_MESSAGES_EN.searchLoading;
}

export function calmLoadMoreMessage(locale: CalmSystemLocale): string {
  return locale === "it" ? SPECIAL_MESSAGES_IT.loadMore : SPECIAL_MESSAGES_EN.loadMore;
}

/** Relative freshness without sync jargon. */
export function calmInboxFreshnessLabel(
  iso: string | null,
  locale: CalmSystemLocale,
): string {
  if (!iso) {
    return locale === "it" ? "Inbox pronta" : "Inbox is ready";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return locale === "it" ? "Inbox pronta" : "Inbox is ready";
  }
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 15) {
    return locale === "it" ? "Inbox al passo" : "Inbox is up to date";
  }
  if (sec < 60) {
    return locale === "it" ? "Inbox al passo · poco fa" : "Inbox is up to date · just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return locale === "it"
      ? `Inbox al passo · ${min} min fa`
      : `Inbox is up to date · ${min}m ago`;
  }
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return locale === "it" ? `Inbox al passo · ${time}` : `Inbox is up to date · ${time}`;
}

export function calmRefreshInboxLabel(locale: CalmSystemLocale): string {
  return locale === "it" ? "Controlla di nuovo" : "Check again";
}
