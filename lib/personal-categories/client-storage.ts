import {
  normalizePersonalCategoriesList,
  parsePersonalCategoriesJson,
} from "@/lib/personal-categories/storage";
import type { PersonalInboxCategory } from "@/lib/personal-categories/types";

export const LOCAL_PERSONAL_CATEGORIES_KEY = "handled_personal_categories_v1";
export const PERSONAL_CATEGORIES_HEADER = "x-handled-personal-categories";

export function loadClientPersonalCategories(): PersonalInboxCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_PERSONAL_CATEGORIES_KEY);
    if (!raw) return [];
    return normalizePersonalCategoriesList(parsePersonalCategoriesJson(JSON.parse(raw)));
  } catch {
    return [];
  }
}

export function saveClientPersonalCategories(categories: PersonalInboxCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCAL_PERSONAL_CATEGORIES_KEY,
      JSON.stringify(normalizePersonalCategoriesList(categories)),
    );
  } catch {
    /* ignore quota */
  }
}

export function personalCategoriesHeaders(): HeadersInit {
  const list = loadClientPersonalCategories();
  if (!list.length) return {};
  try {
    return {
      [PERSONAL_CATEGORIES_HEADER]: btoa(unescape(encodeURIComponent(JSON.stringify(list)))),
    };
  } catch {
    return {};
  }
}

export function parsePersonalCategoriesHeader(
  header: string | null,
): PersonalInboxCategory[] {
  if (!header?.trim()) return [];
  try {
    const json = decodeURIComponent(escape(atob(header.trim())));
    return normalizePersonalCategoriesList(parsePersonalCategoriesJson(JSON.parse(json)));
  } catch {
    return [];
  }
}
