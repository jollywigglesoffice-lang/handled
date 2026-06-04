import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type CategoryApplyScope = "this_email" | "sender" | "similar";

/**
 * Static system-only picker order. UI should prefer `useInboxCategories().catalog.selectorOrder`
 * so personal categories appear everywhere.
 */
export {
  CATEGORY_OPTIONS,
  INBOX_CATEGORY_SELECTOR_ORDER,
} from "@/lib/inbox-ai-categories";

/** Keywords from subject for "similar emails" rules */
export function subjectKeywordsForSimilar(subject: string): string {
  const cleaned = subject
    .replace(/^(re|fwd?):\s*/gi, "")
    .replace(/[^\w\s]/g, " ")
    .trim();
  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^\d+$/.test(w))
    .slice(0, 4);
  return words.join(", ");
}

export type { InboxAiCategory };
