import {
  SYSTEM_INBOX_CATEGORY_VALUES,
  coerceLegacyInboxCategory,
  type InboxAiCategory,
  type SystemInboxCategory,
} from "@/lib/inbox-ai-categories";

/** The four inbox categories allowed in UI and API output. */
export const CANONICAL_INBOX_CATEGORIES = SYSTEM_INBOX_CATEGORY_VALUES;

export function isCanonicalInboxCategory(
  category: string,
): category is SystemInboxCategory {
  return (CANONICAL_INBOX_CATEGORIES as readonly string[]).includes(category);
}

/** Coerce any drift/legacy slug to one of the four canonical categories. */
export function toCanonicalInboxCategory(category: InboxAiCategory): SystemInboxCategory {
  const coerced = coerceLegacyInboxCategory(String(category));
  if (isCanonicalInboxCategory(coerced)) return coerced;
  return "worth_your_attention";
}
