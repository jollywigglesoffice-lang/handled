import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export type DailyBriefingGroupId =
  | "needs_your_reply"
  | "waiting_on_others"
  | "meetings"
  | "payments"
  | "school_family"
  | "opportunities"
  | "promotions_unsubscribe"
  | "follow_ups"
  | "deadlines";

export type DailyBriefingInsightTone =
  | "quiet"
  | "positive"
  | "neutral"
  | "gentle_attention";

export type DailyBriefingHighlight = {
  id: string;
  label: string;
  count: number;
};

export type DailyBriefingGroup = {
  id: DailyBriefingGroupId;
  title: string;
  count: number;
  emailIds: string[];
  calmNote?: string;
};

export type DailyBriefingInsight = {
  id: string;
  message: string;
  tone: DailyBriefingInsightTone;
};

export type DailyBriefingStats = {
  needsReply: number;
  followUpsRecommended: number;
  schoolFamily: number;
  deadlinesApproaching: number;
  travelRelated: number;
  waitingOnOthers: number;
  meetings: number;
  payments: number;
  opportunities: number;
  promotionsUnsubscribe: number;
};

export type DailyBriefingResult = {
  active: boolean;
  generatedAt: string;
  highlights: DailyBriefingHighlight[];
  groups: DailyBriefingGroup[];
  insights: DailyBriefingInsight[];
  stats: DailyBriefingStats;
};

export type DailyBriefingMessage = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  category: InboxAiCategory;
  internalDateMs?: number;
  date?: string;
  relationship?: SenderRelationshipProfile | null;
  hasUnsubscribeSignal?: boolean;
  needsCalendarContext?: boolean;
};

export type AnalyzeDailyBriefingInput = {
  messages: DailyBriefingMessage[];
  locale?: "en" | "it";
};

export type DailyBriefingIntegrationId =
  | "morning_email_digest"
  | "push_summary"
  | "ai_daily_planning"
  | "productivity_summary"
  | "weekly_review";

export type DailyBriefingIntegrationDescriptor = {
  id: DailyBriefingIntegrationId;
  status: "available" | "planned" | "connected";
  description: string;
};
