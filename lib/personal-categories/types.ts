/** User-created inbox category (persisted per account). */
export type PersonalInboxCategory = {
  /** Stable id, e.g. custom:travel */
  id: string;
  label: string;
  labelIt?: string;
  /** Optional hint for AI triage when a strong topical match exists. */
  hint?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export const MAX_PERSONAL_INBOX_CATEGORIES = 24;

export const EMPTY_PERSONAL_CATEGORIES: PersonalInboxCategory[] = [];
