export const FEEDBACK_CATEGORIES = [
  "bug",
  "wrong_category",
  "missing_email",
  "ux_confusion",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export type ScreenContext = {
  url: string;
  pathname: string;
  search: string;
  viewport?: { width: number; height: number };
  userAgent?: string;
  capturedAt: string;
};

export type ProductFeedbackPayload = {
  category: FeedbackCategory;
  message: string;
  includeContext?: boolean;
  context?: ScreenContext | null;
};

export const FEEDBACK_CATEGORY_LABELS: Record<
  FeedbackCategory,
  { en: string; it: string }
> = {
  bug: { en: "Bug", it: "Bug" },
  wrong_category: { en: "Wrong category", it: "Categoria sbagliata" },
  missing_email: { en: "Missing email", it: "Email mancante" },
  ux_confusion: { en: "UX confusion", it: "Confusione UX" },
  other: { en: "Other", it: "Altro" },
};
