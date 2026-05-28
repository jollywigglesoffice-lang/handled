import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { senderRulesToInboxRules } from "@/lib/sender-rules/to-inbox-rules";
import type { SenderRule } from "@/lib/sender-rules/types";
import { parseSenderDomain, parseSenderEmail } from "@/lib/inbox-user-rules/match";
import { logSenderRuleDebug, resolveSenderIdentity } from "@/lib/sender-identity";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

function preferenceToSenderRule(pref: SenderPreference): SenderRule {
  return {
    id: pref.id,
    senderEmail: pref.senderEmail,
    senderDomain: pref.senderDomain,
    targetCategory: pref.category,
    label: pref.label,
    enabled: pref.enabled !== false,
    createdAt: pref.createdAt,
    updatedAt: pref.updatedAt ?? pref.createdAt,
  };
}

export type SenderPreference = {
  id: string;
  senderEmail: string;
  senderDomain: string;
  category: InboxAiCategory;
  label?: string;
  enabled?: boolean;
  createdAt: number;
  updatedAt?: number;
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
  const identity = resolveSenderIdentity(sender);
  const senderEmail = identity.email || identity.ruleKey;
  const senderDomain = identity.domain;
  const pref: SenderPreference = {
    id: newPrefId(),
    senderEmail,
    senderDomain,
    category,
    label,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  logSenderRuleDebug("preferenceFromSender", {
    inputSender: sender,
    senderEmail: pref.senderEmail,
    senderDomain: pref.senderDomain,
    category,
    hasEmail: identity.hasEmail,
    ruleKey: identity.ruleKey,
  });
  return pref;
}

export function senderMatchesPreference(row: Pick<GmailInboxRow, "sender">, pref: SenderPreference): boolean {
  const rowIdentity = resolveSenderIdentity(row.sender);
  const prefEmail = pref.senderEmail?.trim().toLowerCase() ?? "";
  const prefDomain = pref.senderDomain?.trim().toLowerCase() ?? "";

  if (!prefEmail && !prefDomain) return false;

  if (prefEmail.includes("@")) {
    if (rowIdentity.email && rowIdentity.email === prefEmail) return true;
    if (rowIdentity.raw.toLowerCase().includes(prefEmail)) return true;
  }

  if (prefDomain && rowIdentity.domain && rowIdentity.domain === prefDomain) return true;

  if (prefEmail) {
    if (rowIdentity.ruleKey && rowIdentity.ruleKey === prefEmail) return true;
    if (rowIdentity.displayName && rowIdentity.displayName.toLowerCase() === prefEmail) return true;
    if (rowIdentity.raw.toLowerCase().includes(prefEmail)) return true;
  }

  return false;
}

export function applySenderPreference(
  row: GmailInboxRow,
  prefs: SenderPreference[],
): InboxAiCategory | null {
  for (const pref of prefs) {
    if (pref.enabled === false) continue;
    if (senderMatchesPreference(row, pref)) {
      return pref.category;
    }
  }
  return null;
}

/** @deprecated use senderRulesToInboxRules */
export function senderPreferencesToRules(prefs: SenderPreference[]): InboxUserRule[] {
  return senderRulesToInboxRules(prefs.map(preferenceToSenderRule));
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
  return [{ ...incoming, updatedAt: Date.now() }, ...filtered];
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
