import {
  EMAIL_OVERRIDES_HEADER,
  EMAIL_OVERRIDES_STORAGE_KEY,
  overridesToCategoryMap,
  parseEmailOverridesJson,
} from "@/lib/email-overrides/storage";
import type { EmailCategoryOverride } from "@/lib/email-overrides/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export function loadClientEmailOverrides(): EmailCategoryOverride[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EMAIL_OVERRIDES_STORAGE_KEY);
    if (!raw) return [];
    return parseEmailOverridesJson(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveClientEmailOverrides(overrides: EmailCategoryOverride[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EMAIL_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
}

export function loadClientEmailOverrideMap(): Record<string, InboxAiCategory> {
  return overridesToCategoryMap(loadClientEmailOverrides());
}

export function upsertClientEmailOverride(override: EmailCategoryOverride): void {
  const existing = loadClientEmailOverrides().filter((o) => o.emailId !== override.emailId);
  saveClientEmailOverrides([override, ...existing]);
}

export function removeClientEmailOverride(emailId: string): void {
  saveClientEmailOverrides(loadClientEmailOverrides().filter((o) => o.emailId !== emailId));
}

export function emailOverridesHeaders(): HeadersInit {
  const overrides = loadClientEmailOverrides();
  if (overrides.length === 0) return {};
  return {
    [EMAIL_OVERRIDES_HEADER]: JSON.stringify(overrides),
  };
}

export function parseEmailOverridesHeader(raw: string | null): EmailCategoryOverride[] {
  if (!raw?.trim()) return [];
  try {
    return parseEmailOverridesJson(JSON.parse(raw));
  } catch {
    return [];
  }
}
