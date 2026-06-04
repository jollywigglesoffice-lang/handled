import {
  isPersonalInboxCategoryId,
  personalCategoryIdFromLabel,
} from "@/lib/personal-categories/slug";
import {
  EMPTY_PERSONAL_CATEGORIES,
  MAX_PERSONAL_INBOX_CATEGORIES,
  type PersonalInboxCategory,
} from "@/lib/personal-categories/types";
import { SYSTEM_INBOX_CATEGORY_VALUES } from "@/lib/inbox-ai-categories";

const SYSTEM_SLUGS = new Set(
  SYSTEM_INBOX_CATEGORY_VALUES.map((v) => v.toLowerCase()),
);

export function parsePersonalCategoriesJson(raw: unknown): PersonalInboxCategory[] {
  if (!Array.isArray(raw)) return [];
  const out: PersonalInboxCategory[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label || label.length > 48) continue;

    const id =
      typeof row.id === "string" && isPersonalInboxCategoryId(row.id)
        ? row.id
        : personalCategoryIdFromLabel(label);

    const slug = id.slice("custom:".length);
    if (SYSTEM_SLUGS.has(slug)) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const now = Date.now();
    out.push({
      id,
      label,
      labelIt: typeof row.labelIt === "string" ? row.labelIt.trim() || undefined : undefined,
      hint: typeof row.hint === "string" ? row.hint.trim().slice(0, 200) || undefined : undefined,
      sortOrder:
        typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder)
          ? row.sortOrder
          : out.length,
      createdAt: typeof row.createdAt === "number" ? row.createdAt : now,
      updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : now,
    });

    if (out.length >= MAX_PERSONAL_INBOX_CATEGORIES) break;
  }

  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function normalizePersonalCategoriesList(
  list: PersonalInboxCategory[],
): PersonalInboxCategory[] {
  return parsePersonalCategoriesJson(list);
}

export function createPersonalCategory(label: string, existing: PersonalInboxCategory[]): {
  ok: true;
  category: PersonalInboxCategory;
} | { ok: false; error: string } {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  if (existing.length >= MAX_PERSONAL_INBOX_CATEGORIES) {
    return { ok: false, error: `You can add up to ${MAX_PERSONAL_INBOX_CATEGORIES} personal categories.` };
  }
  const id = personalCategoryIdFromLabel(trimmed);
  if (existing.some((c) => c.id === id)) {
    return { ok: false, error: "You already have a category with that name." };
  }
  const now = Date.now();
  return {
    ok: true,
    category: {
      id,
      label: trimmed,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export { EMPTY_PERSONAL_CATEGORIES };
