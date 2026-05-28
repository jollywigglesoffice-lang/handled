import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import {
  loadClientSenderPreferences,
  saveClientSenderPreferences,
  type SenderPreference,
} from "@/lib/inbox-sender-preferences";
import { logSenderRuleDebug } from "@/lib/sender-identity";

function mergeSenderPrefs(local: SenderPreference[], server: SenderPreference[]): SenderPreference[] {
  const byKey = new Map<string, SenderPreference>();

  const keyOf = (p: SenderPreference) =>
    `${p.senderEmail}|${p.senderDomain}`.toLowerCase();

  for (const p of server) {
    byKey.set(keyOf(p), p);
  }
  for (const p of local) {
    const key = keyOf(p);
    const existing = byKey.get(key);
    const localTs = p.updatedAt ?? p.createdAt;
    const serverTs = existing?.updatedAt ?? existing?.createdAt ?? 0;
    if (!existing || localTs >= serverTs) {
      byKey.set(key, p);
    }
  }
  return [...byKey.values()];
}

/** Load sender rules from account; merge with local cache (newest wins per sender key). */
export async function syncSenderPreferencesFromAccount(): Promise<SenderPreference[]> {
  const local = loadClientSenderPreferences();
  if (typeof window === "undefined") return local;

  try {
    const res = await fetch("/api/inbox-feedback", {
      credentials: "same-origin",
      headers: await protectedApiHeaders(),
    });
    const data = (await res.json()) as {
      preferences?: SenderPreference[];
      error?: string;
    };

    if (!res.ok) {
      logSenderRuleDebug("sync GET failed", { status: res.status, error: data.error });
      return local;
    }

    if (Array.isArray(data.preferences)) {
      const merged = mergeSenderPrefs(local, data.preferences);
      saveClientSenderPreferences(merged);
      logSenderRuleDebug("sync OK", { local: local.length, server: data.preferences.length, merged: merged.length });
      return merged;
    }
  } catch (error) {
    logSenderRuleDebug("sync exception", { error: String(error) });
  }

  return local;
}
