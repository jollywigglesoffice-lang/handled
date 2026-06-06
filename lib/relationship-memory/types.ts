import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type SenderRelationshipMemory = {
  profileName: string;
  typicalCategory: string | null;
  typicalCategoryId: InboxAiCategory | null;
  typicalCompletion: string | null;
  /** Relative time only — e.g. "2 days ago". */
  lastInteraction: string | null;
  /** e.g. "1 response" when active waiting with detected reply. */
  waitingOnSummary: string | null;
  interactionCount: number;
};
