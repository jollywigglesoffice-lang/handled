import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { parseSenderDomain, parseSenderEmail } from "@/lib/inbox-user-rules/match";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type SenderPreference = {
  id: string;
  senderEmail: string;
  senderDomain: string;
  category: InboxAiCategory;
  label?: string;
  createdAt: number;
};

export const LOCAL_SENDER_PREFS_KEY = "handled_sender_preferences_v1";
export const SENDER_PREFS_HEADER = "x-handled-sender-preferences";

function newPrefId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function preferenceFromSender(
  sender: string,
  category: InboxAiCategory,
  label?: string,
): SenderPreference {
  const senderEmail = parseSenderEmail(sender) || sender.trim().toLowerCase();
  const senderDomain = parseSenderDomain(sender);
  return {
    id: newPrefId(),
    senderEmail,
    senderDomain,
    category,
    label,
    createdAt: Date.now(),
  };
}

export function senderMatchesPreference(row: Pick<GmailInboxRow, "sender">, pref: SenderPreference): boolean {
  const email = parseSenderEmail(row.sender);
  const domain = parseSenderDomain(row.sender);
  if (pref.senderEmail && email && email === pref.senderEmail) return true;
  if (pref.senderDomain && domain && domain === pref.senderDomain) return true;
  if (pref.senderEmail && row.sender.toLowerCase().includes(pref.senderEmail)) return true;
  return false;
}

export function applySenderPreference(
  row: GmailInboxRow,
  prefs: SenderPreference[],
): InboxAiCategory | null {
  for (const pref of prefs) {
    if (senderMatchesPreference(row, pref)) {
      return pref.category;
    }
  }
  return null;
}

export function senderPreferencesToRules(prefs: SenderPreference[]): InboxUserRule[] {
  return prefs.map((pref, index) => {
    const match =
      pref.senderEmail && pref.senderEmail.includes("@")
        ? ({ type: "sender_email" as const, value: pref.senderEmail })
        : pref.senderDomain
          ? ({ type: "sender_domain" as const, value: pref.senderDomain })
          : ({ type: "sender_contains" as const, value: pref.senderEmail });

    return {
      id: `sender-pref-${pref.id}`,
      enabled: true,
      priority: 250 - index,
      phase: "pre",
      label: pref.label ?? `Always: ${pref.senderEmail || pref.senderDomain}`,
      match,
      action: { type: "force_category", category: pref.category },
    };
  });
}

export function mergeSenderPreferences(
  existing: SenderPreference[],
  incoming: SenderPreference,
): SenderPreference[] {
  const filtered = existing.filter(
    (p) =>
      p.senderEmail !== incoming.senderEmail &&
      (p.senderDomain !== incoming.senderDomain || !incoming.senderDomain),
  );
  return [incoming, ...filtered];
}

export function loadClientSenderPreferences(): SenderPreference[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_SENDER_PREFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SenderPreference[]) : [];
  } catch {
    return [];
  }
}

export function saveClientSenderPreferences(prefs: SenderPreference[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_SENDER_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event("handled-sender-preferences-changed"));
  } catch {
    // ignore
  }
}

export function senderPreferencesHeaders(): HeadersInit {
  const prefs = loadClientSenderPreferences();
  if (!prefs.length) return {};
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(prefs))));
    return { [SENDER_PREFS_HEADER]: encoded };
  } catch {
    return {};
  }
}

export function parseSenderPreferencesHeader(header: string | null): SenderPreference[] {
  if (!header?.trim()) return [];
  try {
    const json = decodeURIComponent(escape(atob(header.trim())));
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as SenderPreference[]) : [];
  } catch {
    return [];
  }
}
