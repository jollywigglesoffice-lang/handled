export type BrainEntryCategory =
  | "business"
  | "personal"
  | "pricing"
  | "policies"
  | "templates"
  | "family_school"
  | "calendar"
  | "general";

export type BrainEntry = {
  id: string;
  idempotencyKey?: string;
  category: BrainEntryCategory;
  title: string;
  content: string;
  updatedAt: number;
};

export type HandledBrain = {
  entries: BrainEntry[];
  /** How the user prefers to sound in replies */
  writingStyle?: string;
};

export const BRAIN_CATEGORY_LABELS: Record<BrainEntryCategory, string> = {
  business: "Business info",
  personal: "Personal info",
  pricing: "Pricing",
  policies: "Policies & refunds",
  templates: "Reusable snippets",
  family_school: "Family & school",
  calendar: "Calendar (coming soon)",
  general: "General knowledge",
};

export const EMPTY_BRAIN: HandledBrain = { entries: [] };
