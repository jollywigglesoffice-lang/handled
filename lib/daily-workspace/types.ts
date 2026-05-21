import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { RelationshipKind } from "@/lib/relationship-intelligence/types";

export type WorkspaceItemKind =
  | "reply"
  | "follow_up"
  | "meeting"
  | "payment"
  | "approval"
  | "attachment"
  | "unsubscribe"
  | "archive"
  | "scheduling";

export type WorkspaceSectionId = "todays_focus" | "waiting_on" | "suggested_actions";

export type WorkspaceItem = {
  id: string;
  emailId: string;
  threadId?: string;
  section: WorkspaceSectionId;
  kind: WorkspaceItemKind;
  title: string;
  calmDetail?: string;
  sender: string;
  subject: string;
  priorityScore: number;
  category: InboxAiCategory;
  requiresUserApproval: true;
};

export type WorkspaceSection = {
  id: WorkspaceSectionId;
  title: string;
  calmNote?: string;
  items: WorkspaceItem[];
};

export type DailyWorkspaceStats = {
  focusCount: number;
  waitingCount: number;
  suggestedCount: number;
  ignorableCount: number;
};

export type DailyWorkspaceResult = {
  active: boolean;
  generatedAt: string;
  calmDay: boolean;
  sections: WorkspaceSection[];
  stats: DailyWorkspaceStats;
  workspaceNote?: string;
};

export type DailyWorkspaceMessage = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  date?: string;
  internalDateMs?: number;
  category: InboxAiCategory;
  relationship?: { kind: RelationshipKind; importance?: string } | null;
  hasUnsubscribeSignal?: boolean;
  needsCalendarContext?: boolean;
};

export type AnalyzeDailyWorkspaceInput = {
  messages: DailyWorkspaceMessage[];
  locale?: "en" | "it";
};

export type DailyWorkspaceIntegrationId =
  | "daily_planning"
  | "ai_scheduling"
  | "task_intelligence"
  | "smart_routines"
  | "operational_memory";

export type DailyWorkspaceIntegrationDescriptor = {
  id: DailyWorkspaceIntegrationId;
  status: "available" | "planned" | "connected";
  description: string;
};
