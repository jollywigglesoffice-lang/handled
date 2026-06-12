import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import {
  loadClientEmailOverrides,
  loadClientEmailOverrideMap,
  removeClientEmailOverride,
  saveClientEmailOverrides,
  upsertClientEmailOverride,
} from "@/lib/email-overrides/client-storage";
import {
  mergeEmailOverridesLocalWins,
  overridesToCategoryMap,
} from "@/lib/email-overrides/storage";
import type { EmailCategoryOverride } from "@/lib/email-overrides/types";
import { scopedEmailKey } from "@/lib/gmail/account-types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Load overrides from account; merge with local cache (server wins on conflict). */
export async function syncEmailOverridesFromAccount(): Promise<Record<string, InboxAiCategory>> {
  const local = loadClientEmailOverrideMap();
  if (typeof window === "undefined") return local;

  try {
    const res = await fetch("/api/email-overrides", {
      credentials: "same-origin",
      headers: await protectedApiHeaders(),
    });
    const data = (await res.json()) as {
      overrides?: EmailCategoryOverride[];
      error?: string;
    };
    if (!res.ok) {
      console.warn("[email-overrides] sync GET failed", res.status, data.error);
    }
    if (res.ok && Array.isArray(data.overrides)) {
      const merged = mergeEmailOverridesLocalWins(
        loadClientEmailOverrides(),
        data.overrides,
      );
      saveClientEmailOverrides(merged);
      return overridesToCategoryMap(merged);
    }
  } catch {
    // offline — use local
  }

  return local;
}

export async function persistEmailOverrideToAccount(input: {
  emailId: string;
  overriddenCategory: InboxAiCategory;
  originalCategory?: InboxAiCategory | null;
  /** When provided, the override is stored under the account-scoped key. */
  accountId?: string;
}): Promise<{ ok: boolean; message: string }> {
  const now = new Date().toISOString();
  const storageKey = scopedEmailKey(input.emailId, input.accountId);
  const optimistic: EmailCategoryOverride = {
    emailId: storageKey,
    originalCategory: input.originalCategory ?? null,
    overriddenCategory: input.overriddenCategory,
    createdAt: now,
    updatedAt: now,
  };
  upsertClientEmailOverride(optimistic);
  if (storageKey !== input.emailId) {
    // Migrate any legacy raw-keyed record so it can't shadow the scoped one.
    removeClientEmailOverride(input.emailId);
  }

  try {
    const res = await fetch("/api/email-overrides", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        ...(await protectedApiHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailId: storageKey,
        overriddenCategory: input.overriddenCategory,
        originalCategory: input.originalCategory,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      override?: EmailCategoryOverride;
      message?: string;
      error?: string;
    };

    if (res.ok && data.override) {
      upsertClientEmailOverride(data.override);
      return { ok: true, message: data.message ?? "Saved" };
    }

    console.warn(
      "[email-overrides] server save failed",
      res.status,
      data.error ?? "unknown",
    );
    return {
      ok: false,
      message: data.error ?? "Saved on this device — will sync when online.",
    };
  } catch {
    return { ok: false, message: "Saved on this device — will sync when online." };
  }
}

export async function removeEmailOverrideFromAccount(
  emailId: string,
  accountId?: string,
): Promise<{ ok: boolean; message: string }> {
  // Remove both the account-scoped key and any legacy raw-keyed record.
  const keys = [scopedEmailKey(emailId, accountId)];
  if (keys[0] !== emailId) keys.push(emailId);
  for (const key of keys) removeClientEmailOverride(key);

  try {
    const headers = await protectedApiHeaders();
    const results = await Promise.all(
      keys.map((key) =>
        fetch(`/api/email-overrides?emailId=${encodeURIComponent(key)}`, {
          method: "DELETE",
          credentials: "same-origin",
          headers,
        }),
      ),
    );
    const primary = results[0];
    const data = (await primary.json()) as { ok?: boolean; message?: string; error?: string };
    if (primary.ok) {
      return { ok: true, message: data.message ?? "Override removed — AI categorization restored." };
    }
    return { ok: false, message: data.error ?? "Removed locally — will sync when online." };
  } catch {
    return { ok: false, message: "Removed locally — will sync when online." };
  }
}
