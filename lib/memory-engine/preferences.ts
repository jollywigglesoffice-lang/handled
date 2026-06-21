import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Inferred intent topics — preference memory, not categories. */
export type PreferenceHint = "meeting" | "financial" | "personal";

const MEETING = /\b(meeting|calendar|invite|scheduled|zoom|teams|meet\.google|availability|rsvp)\b/i;
const FINANCIAL = /\b(invoice|payment|receipt|statement|billing|bank|charge|refund|subscription)\b/i;
const PERSONAL_DOMAINS = /\b(gmail\.com|icloud\.com|outlook\.com|yahoo\.com|hotmail\.com|proton\.me)\b/i;

/** Quiet topic hints from subject + sender — strengthens pattern memory. */
export function inferPreferenceHints(subject: string, sender: string): PreferenceHint[] {
  const hints = new Set<PreferenceHint>();
  const hay = `${subject} ${sender}`.toLowerCase();

  if (MEETING.test(hay)) hints.add("meeting");
  if (FINANCIAL.test(hay)) hints.add("financial");

  const domain = sender.match(/@([\w.-]+)/)?.[1]?.toLowerCase() ?? "";
  if (domain && PERSONAL_DOMAINS.test(domain)) hints.add("personal");

  return [...hints];
}

/** Stable keywords stored in category_pattern_memory for preference learning. */
export function preferenceKeywords(hints: PreferenceHint[]): string[] {
  const map: Record<PreferenceHint, string> = {
    meeting: "meeting",
    financial: "invoice",
    personal: "personal",
  };
  return hints.map((h) => map[h]);
}

/** Default category lean when user repeatedly handles a preference topic. */
export function preferenceCategoryLean(hint: PreferenceHint): InboxAiCategory {
  switch (hint) {
    case "meeting":
      return "worth_your_attention";
    case "financial":
      return "good_to_know";
    case "personal":
      return "worth_your_attention";
  }
}
