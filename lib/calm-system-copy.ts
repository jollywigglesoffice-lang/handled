import type { InboxLoadFailureReason } from "@/lib/inbox-load/types";

/** Poetic calm tone for loading, transitions, empty, and error system states. */
export type CalmSystemLocale = "en" | "it";

export const CALM_LOADING_MESSAGES: Record<CalmSystemLocale, readonly string[]> = {
  en: [
    "Gathering your messages…",
    "Bringing your inbox into focus…",
    "Quietly arranging your emails…",
    "One moment — we're preparing things for you…",
    "Handled is gently organizing your world…",
    "Just a moment…",
  ],
  it: [
    "Raccolgo i tuoi messaggi…",
    "Porto la inbox a fuoco…",
    "Ordino le email con calma…",
    "Un attimo — preparo tutto per te…",
    "Handled organizza il mondo con delicatezza…",
    "Solo un momento…",
  ],
};

export const CALM_TRANSITION_MESSAGES: Record<CalmSystemLocale, readonly string[]> = {
  en: [
    "Listening for new messages…",
    "Tuning your inbox…",
    "Catching up…",
  ],
  it: [
    "Ascolto i nuovi messaggi…",
    "Sintonizzo la tua inbox…",
    "Mi metto al passo…",
  ],
};

export const CALM_EMPTY_MESSAGES: Record<CalmSystemLocale, readonly string[]> = {
  en: [
    "Nothing here right now",
    "Your inbox is quiet",
    "All caught up for now",
  ],
  it: [
    "Niente qui per ora",
    "La tua inbox è tranquilla",
    "Tutto in pari per ora",
  ],
};

type CalmErrorVariant = "inboxUnreachable" | "tryAgain" | "slippedAway";

const CALM_ERROR_BODY: Record<CalmSystemLocale, Record<CalmErrorVariant, string>> = {
  en: {
    inboxUnreachable: "We couldn't reach your inbox right now",
    tryAgain: "Let's try that again in a moment",
    slippedAway: "Something slipped away while we were fetching it",
  },
  it: {
    inboxUnreachable: "Non riusciamo a raggiungere la tua inbox in questo momento",
    tryAgain: "Riproviamo tra un attimo",
    slippedAway: "Qualcosa ci è sfuggito mentre recuperavamo la posta",
  },
};

const CALM_ERROR_TITLES: Record<CalmSystemLocale, Record<CalmErrorVariant, string>> = {
  en: {
    inboxUnreachable: "Your inbox isn't reachable just now",
    tryAgain: "That didn't quite work",
    slippedAway: "Something got away from us",
  },
  it: {
    inboxUnreachable: "La inbox non è raggiungibile adesso",
    tryAgain: "Non ha funzionato del tutto",
    slippedAway: "Qualcosa ci è sfuggito",
  },
};

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
  reconnecting: CALM_TRANSITION_MESSAGES.en[0]!,
  rate_limit_soft: "Catching up — showing your latest mail while things settle.",
  headers_too_large:
    "Something got a little heavy on the way in. Sign out and back in — your inbox is saved.",
  searchLoading: "Looking through your mail…",
  loadMore: "Gathering more messages…",
} as const;

const SPECIAL_MESSAGES_IT = {
  reconnecting: CALM_TRANSITION_MESSAGES.it[0]!,
  rate_limit_soft: "Mi metto al passo — mostro l'ultima posta mentre tutto si sistema.",
  headers_too_large:
    "Qualcosa è stato un po' pesante in arrivo. Esci e accedi di nuovo — la inbox è salvata.",
  searchLoading: "Cerco nella tua posta…",
  loadMore: "Raccolgo altri messaggi…",
} as const;

export function calmLoadingMessages(locale: CalmSystemLocale): string[] {
  return [...CALM_LOADING_MESSAGES[locale]];
}

export function calmTransitionMessages(locale: CalmSystemLocale): string[] {
  return [...CALM_TRANSITION_MESSAGES[locale]];
}

export function calmEmptyMessage(locale: CalmSystemLocale, seed = 0): string {
  const list = CALM_EMPTY_MESSAGES[locale];
  return list[Math.abs(seed) % list.length]!;
}

export function calmEmptyMessages(locale: CalmSystemLocale): string[] {
  return [...CALM_EMPTY_MESSAGES[locale]];
}

export function calmRetryLabel(locale: CalmSystemLocale): string {
  return locale === "it" ? "Riprova" : "Try again";
}

export function calmErrorBody(
  variant: CalmErrorVariant,
  locale: CalmSystemLocale = "en",
): string {
  return CALM_ERROR_BODY[locale][variant];
}

export function calmErrorTitle(
  variant: CalmErrorVariant,
  locale: CalmSystemLocale = "en",
): string {
  return CALM_ERROR_TITLES[locale][variant];
}

export function calmInboxLoadErrorMessage(
  reason: InboxLoadFailureReason | "reconnecting" | "rate_limit_soft",
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
  const variant = INBOX_FAILURE_VARIANT[reason] ?? "inboxUnreachable";
  return calmErrorBody(variant, locale);
}

export function calmInboxLoadErrorTitle(
  reason: InboxLoadFailureReason,
  locale: CalmSystemLocale = "en",
): string {
  const variant = INBOX_FAILURE_VARIANT[reason] ?? "inboxUnreachable";
  return calmErrorTitle(variant, locale);
}

export function calmSearchLoadingMessage(locale: CalmSystemLocale): string {
  return locale === "it" ? SPECIAL_MESSAGES_IT.searchLoading : SPECIAL_MESSAGES_EN.searchLoading;
}

export function calmLoadMoreMessage(locale: CalmSystemLocale): string {
  return locale === "it" ? SPECIAL_MESSAGES_IT.loadMore : SPECIAL_MESSAGES_EN.loadMore;
}

/** Relative freshness without “sync” jargon. */
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
