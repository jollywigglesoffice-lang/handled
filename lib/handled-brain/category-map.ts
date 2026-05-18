import type { BrainEntryCategory, LegacyBrainEntryCategory } from "@/lib/handled-brain/types";

const LEGACY_MAP: Record<string, BrainEntryCategory> = {
  pricing: "pricing",
  faq: "faq",
  policies: "policies",
  family: "family",
  calendar: "calendar",
  snippets: "snippets",
  business: "business",
  personal: "personal",
  general: "faq",
  templates: "snippets",
  family_school: "family",
};

export function normalizeBrainCategory(raw: string): BrainEntryCategory {
  const key = raw.trim().toLowerCase();
  return LEGACY_MAP[key] ?? "faq";
}

export function isBrainEntryCategory(value: string): value is BrainEntryCategory {
  return value in LEGACY_MAP && !["general", "templates", "family_school"].includes(value);
}

export type { LegacyBrainEntryCategory };
