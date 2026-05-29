import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import { saveClientEmailOverrides } from "@/lib/email-overrides/client-storage";
import { persistEmailOverrideToAccount, removeEmailOverrideFromAccount } from "@/lib/email-overrides/client-sync";
import type { CategoryUndoSnapshot } from "@/lib/category-undo/types";
import { saveClientSenderPreferences } from "@/lib/inbox-sender-preferences";
import { saveClientInboxRules } from "@/lib/inbox-rules-client-storage";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategorySource } from "@/lib/inbox-ai-categories";

/** Replace account sender rules with a prior snapshot (no new rule added). */
export async function restoreSenderPreferencesToAccount(
  prefs: import("@/lib/inbox-sender-preferences").SenderPreference[],
): Promise<{ ok: boolean }> {
  saveClientSenderPreferences(prefs);
  try {
    const res = await fetch("/api/inbox-feedback", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        ...(await protectedApiHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "restore_sender_preferences",
        clientPreferences: prefs,
      }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function persistCategoryUndo(snapshot: CategoryUndoSnapshot): Promise<void> {
  saveClientEmailOverrides(snapshot.previousEmailOverrides);

  for (const emailId of snapshot.affectedIds) {
    const priorOverride = snapshot.previousEmailOverrides.find((o) => o.emailId === emailId);
    if (priorOverride) {
      await persistEmailOverrideToAccount({
        emailId,
        overriddenCategory: priorOverride.overriddenCategory,
        originalCategory: priorOverride.originalCategory,
      });
    } else {
      await removeEmailOverrideFromAccount(emailId);
    }
  }

  if (snapshot.scope === "sender") {
    await restoreSenderPreferencesToAccount(snapshot.previousSenderPrefs);
    window.dispatchEvent(new Event("handled-sender-preferences-changed"));
  }

  if (snapshot.scope === "similar") {
    saveClientInboxRules(snapshot.previousInboxRules);
    window.dispatchEvent(new Event("handled-inbox-rules-changed"));
  }

  window.dispatchEvent(new Event("handled-email-overrides-changed"));
}

export function mergeUndoMessages<T extends { id: string; category: InboxAiCategory; categorySource?: CategorySource }>(
  current: T[],
  snapshot: CategoryUndoSnapshot,
): T[] {
  const priorById = new Map(snapshot.previousMessages.map((m) => [m.id, m]));
  return current.map((m) => {
    if (!snapshot.affectedIds.includes(m.id)) return m;
    const prior = priorById.get(m.id);
    if (!prior) return m;
    return {
      ...m,
      category: prior.category,
      categorySource: prior.categorySource as CategorySource | undefined,
    };
  });
}
