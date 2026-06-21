import { inboxLoadUserMessage } from "@/lib/inbox-load/user-messages";
import { normalizeInboxFailureReason } from "@/lib/inbox-load/types";
import type { InboxLoadFailureReason } from "@/lib/inbox-load/types";
import type { UiLocale } from "@/lib/ui-copy";

const ERROR_EN = {
  generic: "Handled couldn't prepare this right now.",
  interrupted: "Something interrupted the request.",
  network: "Network connection lost — check your connection and try again.",
  session: "Session expired — reconnect Gmail.",
  timeout: "That took longer than expected — you can try again.",
  notFound: "This message isn't in your inbox anymore.",
  loadInbox: "Could not load emails — retry.",
  loadEmail: "Handled couldn't open this email just now.",
  emailContent: "Email content could not be loaded.",
  save: "Handled couldn't save that — your changes are still on this device.",
} as const;

const ERROR_IT = {
  generic: "Handled non ha potuto preparare questo adesso.",
  interrupted: "Qualcosa ha interrotto la richiesta.",
  network: "Connessione di rete persa — controlla la connessione e riprova.",
  session: "Sessione scaduta — riconnetti Gmail.",
  timeout: "Ci ha messo piu del previsto — puoi riprovare.",
  notFound: "Questo messaggio non e piu nella tua inbox.",
  loadInbox: "Impossibile caricare le email — riprova.",
  loadEmail: "Handled non ha aperto questa email in questo momento.",
  emailContent: "Impossibile caricare il contenuto dell'email.",
  save: "Handled non ha salvato — le modifiche restano su questo dispositivo.",
} as const;

function errorCopy(locale: UiLocale) {
  return locale === "it" ? ERROR_IT : ERROR_EN;
}

function messageForFailureReason(reason: InboxLoadFailureReason, locale: UiLocale): string {
  return inboxLoadUserMessage(reason, locale);
}

/** Map technical errors to calm, human-centered copy. */
export function calmErrorFromRaw(raw: string, locale: UiLocale = "en"): string {
  const t = errorCopy(locale);
  const hay = raw.toLowerCase();

  const structured = normalizeInboxFailureReason(raw) ?? normalizeInboxFailureReason(hay);
  if (structured) {
    return messageForFailureReason(structured, locale);
  }

  if (/auth_error|missing_account|gmail_fetch_failed|db_error|network_error/.test(hay)) {
    const fromToken = normalizeInboxFailureReason(
      hay.match(
        /auth_error|missing_account|gmail_fetch_failed|db_error|network_error|server_unavailable/,
      )?.[0],
    );
    if (fromToken) return messageForFailureReason(fromToken, locale);
  }

  if (/401|403|auth|session|sign in|account_token_unavailable/.test(hay)) {
    return t.session;
  }
  if (/missing_account|connect_gmail|no email account|account_not_connected/.test(hay)) {
    return messageForFailureReason("missing_account", locale);
  }
  if (/timeout|timed out|abort/.test(hay)) {
    return t.timeout;
  }
  if (/404|not found|found === false/.test(hay)) {
    return t.notFound;
  }
  if (/500|502|503|server_unavailable|db_error|server|crashed|html instead of json/.test(hay)) {
    return t.interrupted;
  }
  if (/gmail_fetch_failed|gmail api|gmail couldn't/.test(hay)) {
    return messageForFailureReason("gmail_fetch_failed", locale);
  }
  if (/could not load gmail|gmail inbox|email api|gmail message|email detail|email_content_empty/.test(hay)) {
    return t.loadEmail;
  }
  if (/email content could not be loaded|body_and_snippet_missing|metadata_fallback_empty/.test(hay)) {
    return t.emailContent;
  }
  if (/save|persist|sync/.test(hay)) {
    return t.save;
  }

  if (/network error|failed to fetch|fetch failed|load failed|enotfound|econnrefused/.test(hay)) {
    return t.network;
  }

  return t.generic;
}

export function calmInboxErrorFromRaw(raw: string, locale: UiLocale = "en"): string {
  const reasonMatch = raw.match(/^reason:([a-z_]+)$/);
  if (reasonMatch?.[1]) {
    const normalized = normalizeInboxFailureReason(reasonMatch[1]);
    if (normalized) return inboxLoadUserMessage(normalized, locale);
  }
  return calmErrorFromRaw(raw || "inbox", locale);
}
