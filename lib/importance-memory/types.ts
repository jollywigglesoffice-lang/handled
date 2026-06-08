export type ImportanceLevel = "important" | "low_priority";

export type SenderImportanceMemory = {
  level: ImportanceLevel;
  /** Human label — no scores or percentages. */
  label: string;
};
