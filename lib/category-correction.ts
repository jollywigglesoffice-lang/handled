import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type CategoryApplyScope = "this_email" | "sender" | "similar";

export const CATEGORY_OPTIONS: InboxAiCategory[] = [
  "needs_attention",
  "quick_reply",
  "promotion",
  "newsletter",
  "handled",
];

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
