import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type SenderWaitingMemoryItem = {
  emailId: string;
  label: string;
  status: "waiting" | "response_received";
  relative: string;
};

export type SenderActivityMemoryItem = {
  emailId: string;
  subject: string;
  actionLabel: string;
  relative: string;
};

export type SenderRelationshipMemory = {
  profileName: string;
  typicalCategory: string | null;
  typicalCategoryId: InboxAiCategory | null;
  typicalCompletion: string | null;
  lastInteractionLabel: string | null;
  waitingItems: SenderWaitingMemoryItem[];
  recentActivity: SenderActivityMemoryItem[];
  interactionCount: number;
};
