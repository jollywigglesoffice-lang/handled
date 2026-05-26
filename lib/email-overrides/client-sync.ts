import {
  loadClientEmailOverrides,
  loadClientEmailOverrideMap,
  removeClientEmailOverride,
  saveClientEmailOverrides,
  upsertClientEmailOverride,
} from "@/lib/email-overrides/client-storage";
import { mergeEmailOverrides, overridesToCategoryMap } from "@/lib/email-overrides/storage";
import type { EmailCategoryOverride } from "@/lib/email-overrides/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Load overrides from account; merge with local cache (server wins on conflict). */
export async function syncEmailOverridesFromAccount(): Promise<Record<string, InboxAiCategory>> {
  const local = loadClientEmailOverrideMap();
  if (typeof window === "undefined") return local;

  try {
    const res = await fetch("/api/email-overrides", { credentials: "same-origin" });
    const data = (await res.json()) as { overrides?: EmailCategoryOverride[] };
    if (res.ok && Array.isArray(data.overrides)) {
      const merged = mergeEmailOverrides(loadClientEmailOverrides(), data.overrides);
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
}): Promise<{ ok: boolean; message: string }> {
  const now = new Date().toISOString();
  const optimistic: EmailCategoryOverride = {
    emailId: input.emailId,
    originalCategory: input.originalCategory ?? null,
    overriddenCategory: input.overriddenCategory,
    createdAt: now,
    updatedAt: now,
  };
  upsertClientEmailOverride(optimistic);

  try {
    const res = await fetch("/api/email-overrides", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
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
): Promise<{ ok: boolean; message: string }> {
  removeClientEmailOverride(emailId);

  try {
    const res = await fetch(
      `/api/email-overrides?emailId=${encodeURIComponent(emailId)}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
    if (res.ok) {
      return { ok: true, message: data.message ?? "Override removed — AI categorization restored." };
    }
    return { ok: false, message: data.error ?? "Removed locally — will sync when online." };
  } catch {
    return { ok: false, message: "Removed locally — will sync when online." };
  }
}
