import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { ConversationState } from "@/lib/follow-up/types";
import type { ConversationStatus } from "@/lib/timeline-intelligence/types";
import type { RelationshipKind } from "@/lib/relationship-intelligence/types";

export type MemorySource =
  | "email"
  | "email_summary"
  | "follow_up"
  | "reminder"
  | "relationship"
  | "handled_brain"
  | "timeline";

export type SmartSearchFilter =
  | "unresolved"
  | "urgent"
  | "school"
  | "doctor"
  | "invoices"
  | "promotions"
  | "waiting_for_response";

export type SearchIntent =
  | "find_mention"
  | "reply_check"
  | "list_follow_ups"
  | "general";

export type MemoryRecord = {
  id: string;
  source: MemorySource;
  emailId?: string;
  threadId?: string;
  title: string;
  body: string;
  sender?: string;
  subject?: string;
  internalDateMs?: number;
  category?: InboxAiCategory;
  relationshipKind?: RelationshipKind;
  followUpState?: ConversationState;
  conversationStatus?: ConversationStatus;
  timelineSummary?: string;
  /** Precomputed filters this record matches */
  filters: SmartSearchFilter[];
  urgencyScore?: number;
};

export type ContextualSearchHit = {
  record: MemoryRecord;
  score: number;
  matchReasons: string[];
  snippetHighlight?: string;
};

export type ContextualSearchAnswer = {
  text: string;
  confidence: "high" | "medium" | "low";
  basedOnEmailIds: string[];
};

export type ContextualSearchResult = {
  query: string;
  parsedFilter?: SmartSearchFilter;
  intents: SearchIntent[];
  hits: ContextualSearchHit[];
  answer: ContextualSearchAnswer | null;
  active: boolean;
};

export type ContextualSearchMessage = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  date?: string;
  internalDateMs?: number;
  category: InboxAiCategory;
  relationship?: { kind: RelationshipKind; label?: string } | null;
  aiSummary?: string;
  timelineIntelligence?: {
    active?: boolean;
    threadSummary?: string;
    conversationStatus?: ConversationStatus;
    escalationScore?: number;
  };
};

export type SearchMemoryInput = {
  query: string;
  messages: ContextualSearchMessage[];
  locale?: "en" | "it";
  activeFilter?: SmartSearchFilter | null;
  brain?: import("@/lib/handled-brain/types").HandledBrain | null;
  reminders?: import("@/lib/follow-up/types").FollowUpReminderRecord[];
};

export type ContextualSearchIntegrationId =
  | "google_drive"
  | "google_calendar"
  | "google_contacts"
  | "cross_platform_memory"
  | "universal_assistant";

export type ContextualSearchIntegrationDescriptor = {
  id: ContextualSearchIntegrationId;
  status: "available" | "planned" | "connected";
  description: string;
};
