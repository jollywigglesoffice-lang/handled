import type { InboxLoadFailureReason } from "@/lib/inbox-load/types";
import type { VoiceLocale } from "@/lib/voice/identity";

/** Canonical Handled voice — single source for system-facing copy. */
export const VOICE: Record<
  VoiceLocale,
  {
    loading: {
      inbox: readonly string[];
      transition: readonly string[];
      openingEmail: string;
      search: string;
      loadMore: string;
      reconnecting: string;
    };
    empty: {
      lines: readonly string[];
      clearedNoise: string;
      completionSubtitles: readonly string[];
    };
    error: {
      genericTitle: string;
      genericBody: string;
      retryTitle: string;
      retryBody: string;
      slippedTitle: string;
      slippedBody: string;
      unreachableTitle: string;
      unreachableBody: string;
      resetBody: string;
      tryAgainLabel: string;
    };
    stress: {
      headlines: readonly string[];
      reassurance: readonly string[];
      recovery: string;
    };
    returning: {
      default: string;
      simple: string;
      lighter: string;
      actionable: string;
      calm: string;
    };
    onboarding: {
      headline: string;
      fallbackTitle: string;
      fallbackBody: string;
    };
    inbox: {
      tagline: string;
      freshnessReady: string;
      freshnessUpToDate: string;
      checkAgain: string;
    };
  }
> = {
  en: {
    loading: {
      inbox: [
        "Gathering your messages…",
        "Bringing your inbox into focus…",
        "Quietly arranging your emails…",
        "One moment — preparing things for you…",
        "Just a moment…",
      ],
      transition: [
        "Listening for new messages…",
        "Tuning your inbox…",
        "Catching up…",
      ],
      openingEmail: "Opening this for you…",
      search: "Looking through your mail…",
      loadMore: "Gathering more messages…",
      reconnecting: "Listening for new messages…",
    },
    empty: {
      lines: [
        "Nothing here right now",
        "Your inbox is quiet",
        "All caught up for now",
      ],
      clearedNoise: "The rest is set aside for later.",
      completionSubtitles: [
        "You don't need to keep checking — Handled will surface anything that matters.",
        "Step away when you want. New mail will appear here when it arrives.",
        "The quiet is real. Nothing is waiting on you right now.",
        "Low-priority mail is set aside for whenever you want it.",
      ],
    },
    error: {
      genericTitle: "Something went wrong",
      genericBody: "Something went wrong. Let's try again.",
      retryTitle: "That didn't work",
      retryBody: "We couldn't load this. Please retry.",
      slippedTitle: "Something went wrong",
      slippedBody: "Something slipped away while we were fetching it. Let's try again.",
      unreachableTitle: "Couldn't reach your inbox",
      unreachableBody: "We couldn't reach your inbox right now. Let's try again.",
      resetBody: "This didn't work. I've reset it — try again when you're ready.",
      tryAgainLabel: "Try again",
    },
    stress: {
      headlines: [
        "Let's take this one step at a time.",
        "We'll clear the important things first.",
        "No need to handle everything now.",
      ],
      reassurance: [
        "We don't need to finish everything right now.",
        "I'll help you get back to a calm inbox.",
        "We can go at your pace.",
      ],
      recovery: "Things look lighter — I'll show you a bit more when you're ready.",
    },
    returning: {
      default: "Welcome back — I've prepared your inbox the way you usually like it.",
      simple: "Welcome back — I've kept things simple for you.",
      lighter: "Welcome back — I've adjusted things to keep your inbox lighter.",
      actionable: "Welcome back — I'll surface what's actionable first.",
      calm: "Welcome back — take your time, nothing urgent.",
    },
    onboarding: {
      headline: "Let's set up your inbox together.",
      fallbackTitle: "Nothing demanding your attention right now.",
      fallbackBody: "Your inbox looks calm. Skip ahead or refresh whenever you like.",
    },
    inbox: {
      tagline: "Email, quietly handled.",
      freshnessReady: "Inbox is ready",
      freshnessUpToDate: "Inbox is up to date",
      checkAgain: "Check again",
    },
  },
  it: {
    loading: {
      inbox: [
        "Raccolgo i tuoi messaggi…",
        "Porto la inbox a fuoco…",
        "Ordino le email con calma…",
        "Un attimo — preparo tutto per te…",
        "Solo un momento…",
      ],
      transition: [
        "Ascolto i nuovi messaggi…",
        "Sintonizzo la tua inbox…",
        "Mi metto al passo…",
      ],
      openingEmail: "Apro l'email per te…",
      search: "Cerco nella tua posta…",
      loadMore: "Raccolgo altri messaggi…",
      reconnecting: "Ascolto i nuovi messaggi…",
    },
    empty: {
      lines: [
        "Niente qui per ora",
        "La tua inbox è tranquilla",
        "Tutto in pari per ora",
      ],
      clearedNoise: "Il resto è messo da parte per dopo.",
      completionSubtitles: [
        "Non serve continuare a controllare — Handled farà emergere ciò che conta.",
        "Stacca quando vuoi. La nuova posta apparirà qui quando arriva.",
        "La calma è reale. Niente ti sta aspettando adesso.",
        "La posta a bassa priorità è da parte per quando vuoi.",
      ],
    },
    error: {
      genericTitle: "Qualcosa non ha funzionato",
      genericBody: "Qualcosa non ha funzionato. Riproviamo.",
      retryTitle: "Non ha funzionato",
      retryBody: "Non siamo riusciti a caricare. Riprova.",
      slippedTitle: "Qualcosa non ha funzionato",
      slippedBody: "Qualcosa ci è sfuggito. Riproviamo.",
      unreachableTitle: "Inbox non raggiungibile",
      unreachableBody: "Non riusciamo a raggiungere la inbox adesso. Riproviamo.",
      resetBody: "Non ha funzionato. Ho resettato — riprova quando vuoi.",
      tryAgainLabel: "Riprova",
    },
    stress: {
      headlines: [
        "Un passo alla volta.",
        "Partiamo dalle cose importanti.",
        "Non serve gestire tutto adesso.",
      ],
      reassurance: [
        "Non dobbiamo finire tutto adesso.",
        "Ti aiuto a tornare a una inbox tranquilla.",
        "Andiamo con calma.",
      ],
      recovery: "Sembra più leggero — ti mostro un po' di più quando vuoi.",
    },
    returning: {
      default: "Bentornato — ho preparato la inbox come ti piace di solito.",
      simple: "Bentornato — ho mantenuto le cose semplici per te.",
      lighter: "Bentornato — ho alleggerito la inbox per te.",
      actionable: "Bentornato — metto in evidenza prima ciò che richiede azione.",
      calm: "Bentornato — prenditi il tuo tempo, niente di urgente.",
    },
    onboarding: {
      headline: "Configuriamo la inbox insieme.",
      fallbackTitle: "Niente richiede attenzione adesso.",
      fallbackBody: "La inbox sembra tranquilla. Salta avanti o aggiorna quando vuoi.",
    },
    inbox: {
      tagline: "Email, gestite con calma.",
      freshnessReady: "Inbox pronta",
      freshnessUpToDate: "Inbox al passo",
      checkAgain: "Controlla di nuovo",
    },
  },
};

type ErrorVariant = "generic" | "retry" | "slipped" | "unreachable" | "reset";

const INBOX_FAILURE_VARIANT: Record<InboxLoadFailureReason, ErrorVariant> = {
  network_error: "slipped",
  timeout: "retry",
  auth_error: "unreachable",
  missing_account: "unreachable",
  gmail_fetch_failed: "unreachable",
  gmail_rate_limit: "retry",
  db_error: "retry",
  server_unavailable: "retry",
  categorization_failure: "slipped",
  headers_too_large: "reset",
  unknown: "unreachable",
};

export function voiceErrorTitle(
  variant: ErrorVariant,
  locale: VoiceLocale = "en",
): string {
  const e = VOICE[locale].error;
  switch (variant) {
    case "retry":
      return e.retryTitle;
    case "slipped":
      return e.slippedTitle;
    case "unreachable":
      return e.unreachableTitle;
    case "reset":
      return e.genericTitle;
    default:
      return e.genericTitle;
  }
}

export function voiceErrorBody(
  variant: ErrorVariant,
  locale: VoiceLocale = "en",
): string {
  const e = VOICE[locale].error;
  switch (variant) {
    case "retry":
      return e.retryBody;
    case "slipped":
      return e.slippedBody;
    case "unreachable":
      return e.unreachableBody;
    case "reset":
      return e.resetBody;
    default:
      return e.genericBody;
  }
}

export function voiceInboxLoadError(
  reason: InboxLoadFailureReason | "reconnecting" | "rate_limit_soft" | "headers_too_large",
  locale: VoiceLocale = "en",
): string {
  if (reason === "reconnecting") return VOICE[locale].loading.reconnecting;
  if (reason === "rate_limit_soft") {
    return locale === "it"
      ? "Mi metto al passo — mostro l'ultima posta mentre tutto si sistema."
      : "Catching up — showing your latest mail while things settle.";
  }
  if (reason === "headers_too_large") {
    return voiceErrorBody("reset", locale);
  }
  const variant = INBOX_FAILURE_VARIANT[reason] ?? "unreachable";
  return voiceErrorBody(variant, locale);
}

export function voiceInboxLoadErrorTitle(
  reason: InboxLoadFailureReason,
  locale: VoiceLocale = "en",
): string {
  const variant = INBOX_FAILURE_VARIANT[reason] ?? "unreachable";
  return voiceErrorTitle(variant, locale);
}

export function voiceLoadingInbox(locale: VoiceLocale): readonly string[] {
  return VOICE[locale].loading.inbox;
}

export function voiceLoadingTransition(locale: VoiceLocale): readonly string[] {
  return VOICE[locale].loading.transition;
}

export function voiceEmptyLine(locale: VoiceLocale, seed = 0): string {
  const lines = VOICE[locale].empty.lines;
  return lines[Math.abs(seed) % lines.length]!;
}

export function voiceEmptyLines(locale: VoiceLocale): readonly string[] {
  return VOICE[locale].empty.lines;
}

export function voiceStressHeadline(locale: VoiceLocale, seed: number): string {
  const lines = VOICE[locale].stress.headlines;
  return lines[Math.abs(seed) % lines.length]!;
}

export function voiceStressReassurance(locale: VoiceLocale, seed: number): string {
  const lines = VOICE[locale].stress.reassurance;
  return lines[Math.abs(seed) % lines.length]!;
}

export function voiceStressRecovery(locale: VoiceLocale): string {
  return VOICE[locale].stress.recovery;
}

export function voiceTryAgainLabel(locale: VoiceLocale): string {
  return VOICE[locale].error.tryAgainLabel;
}
