import { analyzeActionIntelligence } from "@/lib/action-intelligence";
import { classifyTimeImpact } from "@/lib/time-impact/classify";
import type { ActionIntelligenceResult } from "@/lib/action-intelligence";
import { buildCalendarAwareness } from "@/lib/calendar-awareness";
import { classifyCalendarIntent } from "@/lib/calendar-awareness/classify-intent";
import { categorizeGmailInboxRows } from "@/lib/categorize-inbox-messages";
import { analyzeDecisionAssistance } from "@/lib/decision-assistance";
import type { DecisionAssistanceResult } from "@/lib/decision-assistance";
import { buildEmailSummary, heuristicEmailSummary } from "@/lib/email-summary";
import { analyzeFollowUp } from "@/lib/follow-up/analyze";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import type { GmailInboxRow } from "@/lib/gmail-api";
import { EMPTY_CATEGORY_CATALOG } from "@/lib/inbox-category-catalog";
import { loadCategorizationContext } from "@/lib/load-user-categorization-context";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { assessReplyNeed } from "@/lib/reply-necessity";
import { analyzeProactiveAssistant } from "@/lib/proactive-assistant";
import type { ProactiveAssistantResult } from "@/lib/proactive-assistant";
import { analyzeTimelineIntelligence } from "@/lib/timeline-intelligence";
import type { TimelineIntelligenceResult } from "@/lib/timeline-intelligence";
import { toThreadSnapshot } from "@/lib/timeline-intelligence/thread-group";
import { analyzeUnsubscribe } from "@/lib/unsubscribe/detect";
import type { UnsubscribeAnalysis } from "@/lib/unsubscribe/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { WorkflowMode } from "@/lib/workflow-mode";

export type EmailDetailEnrichmentMeta = {
  id: string;
  /** Connected account that owns the message — scopes manual override lookups. */
  accountId?: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  internalDateMs: number;
};

export type EmailDetailIntelligence = {
  category: InboxAiCategory;
  relationship?: SenderRelationshipProfile;
  aiSummary: string;
  followUpAnalysis?: FollowUpAnalysis;
  calendarAwareness: ReturnType<typeof buildCalendarAwareness>;
  actionIntelligence: ActionIntelligenceResult;
  timelineIntelligence: TimelineIntelligenceResult;
  proactiveAssistant: ProactiveAssistantResult;
  decisionAssistance: DecisionAssistanceResult;
  unsubscribeAnalysis: UnsubscribeAnalysis;
  enrichmentWarnings: string[];
};

const EMPTY_ACTION: ActionIntelligenceResult = {
  actionable: false,
  actionState: "passive",
  impliedActions: [],
  labels: [],
  primaryLabel: null,
  suggestedNextAction: null,
  taskAwareness: [],
  safeReminders: [],
  confidence: 0,
};

const EMPTY_TIMELINE: TimelineIntelligenceResult = {
  active: false,
  conversationStatus: "open",
  trajectory: "calm",
  escalationScore: 0,
  timelineSummary: "",
  threadMemory: {
    requestedActions: [],
    mentionedDeadlines: [],
    mentionedAttachments: false,
    unresolvedCommitments: [],
    followUpCount: 0,
    userRepliedHeuristic: false,
    otherRepliedHeuristic: false,
  },
  progression: {
    repeatedFollowUps: false,
    escalatingUrgency: false,
    unresolvedThread: false,
    pendingRequest: false,
    longRunning: false,
    threadSpanDays: 0,
  },
  visibilityBoost: 0,
};

const EMPTY_PROACTIVE: ProactiveAssistantResult = {
  active: false,
  suggestions: [],
  urgencyScore: 0,
  upcomingCommitments: [],
  incompleteActions: [],
};

const EMPTY_DECISION: DecisionAssistanceResult = {
  active: false,
  userMustDecide: true,
  primaryConfidence: "low_suggestion",
  insights: [],
  opportunities: [],
  risks: [],
  awarenessKinds: [],
};

function logEnrichmentFailure(step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[email-detail] enrichment step failed: ${step}`, {
    message,
    stack,
    error,
  });
}

function safeSync<T>(step: string, fn: () => T, fallback: T, warnings: string[]): T {
  try {
    return fn();
  } catch (error) {
    logEnrichmentFailure(step, error);
    warnings.push(step);
    return fallback;
  }
}

async function safeAsync<T>(
  step: string,
  fn: () => Promise<T>,
  fallback: T,
  warnings: string[],
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logEnrichmentFailure(step, error);
    warnings.push(step);
    return fallback;
  }
}

export function toEnrichmentMeta(input: {
  id: string;
  accountId?: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  date?: string;
  internalDateMs?: number;
}): EmailDetailEnrichmentMeta {
  return {
    id: input.id,
    accountId: input.accountId,
    threadId: input.threadId ?? input.id,
    sender: input.sender ?? "",
    subject: input.subject ?? "(No subject)",
    snippet: input.snippet ?? "",
    date: input.date ?? "",
    internalDateMs:
      typeof input.internalDateMs === "number" && !Number.isNaN(input.internalDateMs)
        ? input.internalDateMs
        : 0,
  };
}

export function toGmailRow(meta: EmailDetailEnrichmentMeta): GmailInboxRow {
  return {
    id: meta.id,
    accountId: meta.accountId,
    threadId: meta.threadId,
    sender: meta.sender,
    subject: meta.subject,
    snippet: meta.snippet,
    date: meta.date,
    internalDateMs: meta.internalDateMs,
  };
}

export async function enrichEmailDetailIntelligence(
  meta: EmailDetailEnrichmentMeta,
  userId: string,
  workflowMode: WorkflowMode,
  options?: {
    displayPlain?: string;
    bodyHtml?: string;
    listUnsubscribe?: string;
    listUnsubscribePost?: string;
    locale?: "en" | "it";
  },
): Promise<EmailDetailIntelligence> {
  const warnings: string[] = [];
  const row = toGmailRow(meta);
  const displayPlain = options?.displayPlain ?? meta.snippet;
  const locale = options?.locale ?? "en";

  const rulesCtx = await safeAsync(
    "loadCategorizationContext",
    () => loadCategorizationContext(userId),
    {
      emailOverrides: {},
      emailOverrideRecords: [],
      memoryRules: [],
      memorySnapshot: { senderMemory: [], categoryCorrections: [], categoryPatterns: [], actionMemory: [] },
      senderRules: [],
      keywordRules: [],
      allRules: [],
      senderRelationships: [],
      personalCategories: [],
      categoryCatalog: EMPTY_CATEGORY_CATALOG,
    },
    warnings,
  );

  const categorized = await safeAsync(
    "categorizeGmailInboxRows",
    async () => {
      const rows = await categorizeGmailInboxRows([row], {
        emailOverrides: rulesCtx.emailOverrides,
        memoryRules: rulesCtx.memoryRules,
        senderRules: rulesCtx.senderRules,
        userRules: rulesCtx.keywordRules,
        senderRelationships: rulesCtx.senderRelationships,
        workflowMode,
        categoryCatalog: rulesCtx.categoryCatalog,
      });
      return rows[0];
    },
    undefined,
    warnings,
  );

  const category: InboxAiCategory = categorized?.category ?? "worth_your_attention";
  const relationship = categorized?.relationship;

  const aiSummary = await safeAsync(
    "buildEmailSummary",
    () => buildEmailSummary(row, category, workflowMode, locale),
    heuristicEmailSummary(row, category),
    warnings,
  );

  const followUpAnalysis = safeSync(
    "analyzeFollowUp",
    () =>
      analyzeFollowUp(row, category, {
        workflowMode,
        senderRelationships: rulesCtx.senderRelationships,
      }) ?? undefined,
    undefined,
    warnings,
  );

  const calendarAwarenessBase = safeSync(
    "buildCalendarAwareness",
    () => buildCalendarAwareness(row, displayPlain),
    {
      schedulingIntent: {
        detected: false,
        kinds: [],
        needsCalendarContext: false,
        confidence: 0,
        matchedPhrases: [],
        requiresUserApproval: true,
      },
      needsCalendarContext: false,
      calendarIntentLevel: "NO_TIME_CONTEXT",
      calendarConnected: false,
    },
    warnings,
  );

  const actionIntelligence = safeSync(
    "analyzeActionIntelligence",
    () =>
      analyzeActionIntelligence({
        row,
        category,
        extraBody: displayPlain,
        locale,
      }),
    EMPTY_ACTION,
    warnings,
  );

  const timeImpact = safeSync(
    "classifyTimeImpact",
    () =>
      classifyTimeImpact({
        row,
        category,
        needsCalendarContext: calendarAwarenessBase.needsCalendarContext,
        actionIntelligence,
        extraBody: displayPlain,
      }),
    { kind: "time_free", flowBand: "awareness_flow", timeBand: null, priorityScore: 0 },
    warnings,
  );

  const calendarAwareness = {
    ...calendarAwarenessBase,
    calendarIntentLevel: classifyCalendarIntent({
      row,
      extraBody: displayPlain,
      needsCalendarContext: calendarAwarenessBase.needsCalendarContext,
      timeImpactKind: timeImpact.kind,
    }),
  };

  const timelineIntelligence = safeSync(
    "analyzeTimelineIntelligence",
    () =>
      analyzeTimelineIntelligence({
        row: toThreadSnapshot({ ...row, category }),
        extraBody: displayPlain,
        locale,
      }),
    EMPTY_TIMELINE,
    warnings,
  );

  const proactiveAssistant = safeSync(
    "analyzeProactiveAssistant",
    () =>
      analyzeProactiveAssistant({
        row: { ...meta, category },
        extraBody: displayPlain,
        locale,
        senderRelationships: rulesCtx.senderRelationships,
      }),
    EMPTY_PROACTIVE,
    warnings,
  );

  const decisionAssistance = safeSync(
    "analyzeDecisionAssistance",
    () =>
      analyzeDecisionAssistance({
        row: { ...meta, category },
        extraBody: displayPlain,
        locale,
        senderRelationships: rulesCtx.senderRelationships,
      }),
    EMPTY_DECISION,
    warnings,
  );

  const unsubscribeAnalysis = safeSync(
    "analyzeUnsubscribe",
    () =>
      analyzeUnsubscribe({
        bodyPlain: displayPlain,
        bodyHtml: options?.bodyHtml ?? "",
        snippet: meta.snippet,
        listUnsubscribe: options?.listUnsubscribe,
        listUnsubscribePost: options?.listUnsubscribePost,
        inboxCategory: category,
      }),
    {
      showBadge: false,
      badgeLabel: "",
      isNewsletterLike: false,
      primaryMethod: null,
      methods: [],
      suggestedReplyText: null,
    },
    warnings,
  );

  if (warnings.length > 0) {
    console.warn("[email-detail] partial enrichment — using fallbacks for:", warnings.join(", "));
  }

  return {
    category,
    relationship,
    aiSummary: aiSummary || heuristicEmailSummary(row, category),
    followUpAnalysis,
    calendarAwareness,
    actionIntelligence,
    timelineIntelligence,
    proactiveAssistant,
    decisionAssistance,
    unsubscribeAnalysis,
    enrichmentWarnings: warnings,
  };
}
