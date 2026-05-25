import type { UiLocale } from "@/lib/ui-copy";

const ERROR_EN = {
  generic: "Handled couldn't prepare this right now.",
  interrupted: "Something interrupted the request.",
  network: "Handled couldn't reach the server — try again in a moment.",
  session: "Your session needs a quick refresh — sign in again if this persists.",
  timeout: "That took longer than expected — you can try again.",
  notFound: "This message isn't in your inbox anymore.",
  loadInbox: "Handled couldn't load your inbox just now.",
  loadEmail: "Handled couldn't open this email just now.",
  save: "Handled couldn't save that — your changes are still on this device.",
} as const;

const ERROR_IT = {
  generic: "Handled non ha potuto preparare questo adesso.",
  interrupted: "Qualcosa ha interrotto la richiesta.",
  network: "Handled non ha raggiunto il server — riprova tra un attimo.",
  session: "Serve un rapido refresh della sessione — accedi di nuovo se persiste.",
  timeout: "Ci ha messo piu del previsto — puoi riprovare.",
  notFound: "Questo messaggio non e piu nella tua inbox.",
  loadInbox: "Handled non ha caricato la inbox in questo momento.",
  loadEmail: "Handled non ha aperto questa email in questo momento.",
  save: "Handled non ha salvato — le modifiche restano su questo dispositivo.",
} as const;

function errorCopy(locale: UiLocale) {
  return locale === "it" ? ERROR_IT : ERROR_EN;
}

/** Map technical errors to calm, human-centered copy. */
export function calmErrorFromRaw(raw: string, locale: UiLocale = "en"): string {
  const t = errorCopy(locale);
  const hay = raw.toLowerCase();

  if (/network error|failed to fetch|fetch failed|load failed|enotfound|econnrefused/.test(hay)) {
    return t.network;
  }
  if (/timeout|timed out|abort/.test(hay)) {
    return t.timeout;
  }
  if (/401|403|auth|session|sign in|missing_google_token/.test(hay)) {
    return t.session;
  }
  if (/404|not found|found === false/.test(hay)) {
    return t.notFound;
  }
  if (/500|502|503|server|crashed|html instead of json/.test(hay)) {
    return t.interrupted;
  }
  if (/could not load gmail|gmail inbox/.test(hay)) {
    return t.loadInbox;
  }
  if (/email api|gmail message|email detail/.test(hay)) {
    return t.loadEmail;
  }
  if (/save|persist|sync/.test(hay)) {
    return t.save;
  }

  return t.generic;
}

export function calmInboxErrorFromRaw(raw: string, locale: UiLocale = "en"): string {
  return calmErrorFromRaw(raw || "inbox", locale);
}
