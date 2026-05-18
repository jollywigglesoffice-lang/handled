import type { BrainEntryCategory } from "@/lib/handled-brain/types";

/** Extensible source id — add drive, docs, calendar, contacts later */
export type KnowledgeSourceId =
  | "handled_brain"
  | "google_drive"
  | "google_docs"
  | "google_calendar"
  | "google_contacts";

export type KnowledgeChunk = {
  id: string;
  source: KnowledgeSourceId;
  title: string;
  content: string;
  category?: BrainEntryCategory | string;
  updatedAt?: number;
};

export type KnowledgeMatchReason =
  | "title_match"
  | "keyword_overlap"
  | "category_intent"
  | "semantic_topic";

export type ScoredKnowledgeChunk = KnowledgeChunk & {
  score: number;
  matchReasons: KnowledgeMatchReason[];
};

export type KnowledgeRetrievalInput = {
  emailText: string;
  subject?: string;
  /** Optional intent from reply-context analysis */
  primaryIntent?: string;
  intentKinds?: string[];
};

export type KnowledgeRetrievalResult = {
  chunks: ScoredKnowledgeChunk[];
  writingStyle?: string;
  /** Formatted block for LLM prompt */
  promptBlock: string;
  active: boolean;
  writingStyleUsed: boolean;
};

export type BrainUsageEntryDto = {
  id: string;
  source: KnowledgeSourceId;
  title: string;
  category: string;
  contentPreview: string;
  score: number;
  matchReasons: KnowledgeMatchReason[];
};

export type BrainUsageDto = {
  active: boolean;
  writingStyleUsed: boolean;
  entries: BrainUsageEntryDto[];
};
