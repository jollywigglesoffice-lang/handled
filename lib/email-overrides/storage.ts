import { normalizeInboxAiCategory, type InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { EmailCategoryOverride } from "@/lib/email-overrides/types";

export const EMAIL_OVERRIDES_STORAGE_KEY = "handled_email_overrides_v1";
export const EMAIL_OVERRIDES_HEADER = "x-handled-email-overrides";
export const SETUP_SQL = "supabase/sql/email_overrides.sql";

export function overridesToCategoryMap(
  overrides: EmailCategoryOverride[],
): Record<string, InboxAiCategory> {
  const map: Record<string, InboxAiCategory> = {};
  for (const o of overrides) {
    map[o.emailId] = o.overriddenCategory;
  }
  return map;
}

export function parseEmailOverridesJson(raw: unknown): EmailCategoryOverride[] {
  if (!Array.isArray(raw)) return [];
  const out: EmailCategoryOverride[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const emailId = typeof row.emailId === "string" ? row.emailId.trim() : "";
    if (!emailId) continue;
    const overriddenCategory = normalizeInboxAiCategory(
      typeof row.overriddenCategory === "string" ? row.overriddenCategory : "",
    );
    const originalCategory =
      typeof row.originalCategory === "string" && row.originalCategory.trim()
        ? normalizeInboxAiCategory(row.originalCategory)
        : null;
    out.push({
      emailId,
      originalCategory,
      overriddenCategory,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
    });
  }
  return out;
}

export function isEmailOverridesTableMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("email_overrides") && (m.includes("does not exist") || m.includes("schema cache"));
}

/** Merge overrides — newest `updatedAt` wins per email. */
export function mergeEmailOverrides(
  ...lists: EmailCategoryOverride[][]
): EmailCategoryOverride[] {
  const byId = new Map<string, EmailCategoryOverride>();
  for (const list of lists) {
    for (const o of list) {
      const existing = byId.get(o.emailId);
      if (!existing) {
        byId.set(o.emailId, o);
        continue;
      }
      const a = new Date(o.updatedAt).getTime();
      const b = new Date(existing.updatedAt).getTime();
      if (a >= b) byId.set(o.emailId, o);
    }
  }
  return [...byId.values()];
}
