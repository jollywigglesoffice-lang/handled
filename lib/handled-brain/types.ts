/** Canonical categories for Handled Brain */
export type BrainEntryCategory =
  | "pricing"
  | "faq"
  | "policies"
  | "family"
  | "calendar"
  | "snippets"
  | "business"
  | "personal";

/** Legacy slugs stored in old JSON / migrations */
export type LegacyBrainEntryCategory =
  | "general"
  | "templates"
  | "family_school"
  | BrainEntryCategory;

export type BrainEntry = {
  id: string;
  idempotencyKey?: string;
  category: BrainEntryCategory;
  title: string;
  content: string;
  updatedAt: number;
  createdAt?: number;
  sortOrder?: number;
};

export type HandledBrain = {
  entries: BrainEntry[];
  writingStyle?: string;
};

export const BRAIN_CATEGORY_LABELS: Record<BrainEntryCategory, string> = {
  pricing: "Pricing",
  faq: "FAQ",
  policies: "Policies",
  family: "Family",
  calendar: "Calendar",
  snippets: "Snippets",
  business: "Business",
  personal: "Personal",
};

export const BRAIN_CATEGORY_ORDER: BrainEntryCategory[] = [
  "pricing",
  "faq",
  "policies",
  "business",
  "personal",
  "family",
  "snippets",
  "calendar",
];

export const EMPTY_BRAIN: HandledBrain = { entries: [] };

export type BrainSyncStatus = "idle" | "syncing" | "saved" | "error" | "offline_cached";

export type BrainSaveResult =
  | {
      ok: true;
      storageMode: "cloud";
      message: string;
      lastSyncedAt: string;
    }
  | {
      ok: false;
      error: string;
      clientLocalOk?: boolean;
      hint?: string;
    };
