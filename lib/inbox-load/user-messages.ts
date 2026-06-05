import type { InboxLoadFailureReason } from "@/lib/inbox-load/types";
import type { UiLocale } from "@/lib/ui-copy";

const MESSAGES_EN: Record<InboxLoadFailureReason | "reconnecting", string> = {
  network_failure: "Network connection lost — check your connection and try again.",
  timeout: "Inbox load timed out — try again in a moment.",
  oauth_expired: "Gmail connection expired — sign in with Google again.",
  oauth_missing: "Connect Gmail to load your inbox.",
  gmail_api_failure: "Gmail couldn't load your inbox — try again.",
  gmail_rate_limit: "Gmail rate limit reached — wait a moment and try again.",
  supabase_failure: "Server unavailable — try again in a moment.",
  auth_failure: "Your session expired — sign in again.",
  server_unavailable: "Server unavailable — try again in a moment.",
  categorization_failure: "Handled couldn't organize your inbox — try again.",
  unknown: "Handled couldn't load your inbox just now.",
  reconnecting: "Reconnecting to Gmail…",
};

const MESSAGES_IT: Record<InboxLoadFailureReason | "reconnecting", string> = {
  network_failure: "Connessione persa — controlla la rete e riprova.",
  timeout: "Caricamento inbox scaduto — riprova tra un attimo.",
  oauth_expired: "Connessione Gmail scaduta — accedi di nuovo con Google.",
  oauth_missing: "Collega Gmail per caricare la inbox.",
  gmail_api_failure: "Gmail non ha caricato la inbox — riprova.",
  gmail_rate_limit: "Limite Gmail raggiunto — attendi un momento e riprova.",
  supabase_failure: "Server non disponibile — riprova tra un attimo.",
  auth_failure: "Sessione scaduta — accedi di nuovo.",
  server_unavailable: "Server non disponibile — riprova tra un attimo.",
  categorization_failure: "Handled non ha organizzato la inbox — riprova.",
  unknown: "Handled non ha caricato la inbox in questo momento.",
  reconnecting: "Riconnessione a Gmail…",
};

export function inboxLoadUserMessage(
  reason: InboxLoadFailureReason | "reconnecting",
  locale: UiLocale = "en",
): string {
  const table = locale === "it" ? MESSAGES_IT : MESSAGES_EN;
  return table[reason] ?? table.unknown;
}
