import { analyzeActionIntelligence } from "@/lib/action-intelligence";
import { analyzeFollowUp } from "@/lib/follow-up/analyze";
import { detectStalledSignals } from "@/lib/follow-up/smart-engine/detect-stalled";
import { resolveSenderRelationship } from "@/lib/relationship-intelligence/resolve";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
import { analyzeTimelineIntelligence } from "@/lib/timeline-intelligence";
import { toThreadSnapshot } from "@/lib/timeline-intelligence/thread-group";
import { detectUpcomingCommitments } from "@/lib/proactive-assistant/detect-commitments";
import { detectIncompleteActions } from "@/lib/proactive-assistant/detect-incomplete";
import { buildProactiveSuggestions } from "@/lib/proactive-assistant/suggestions";
import {
  scoreProactiveUrgency,
  sortSuggestions,
} from "@/lib/proactive-assistant/urgency";
import type {
  AnalyzeProactiveInput,
  ProactiveAssistantResult,
  ProactiveAssistantSummary,
  ProactiveSuggestion,
} from "@/lib/proactive-assistant/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { GmailInboxRow } from "@/lib/gmail-api";

function daysSince(ms: number): number {
  if (!ms) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000)));
}

const SCHOOL_FAMILY = /school|teacher|family|pediatric|scuola|insegnante|genitori/i;
const FINANCIAL = /invoice|payment|billing|fattura|pagamento/i;

export function analyzeProactiveAssistant(
  input: AnalyzeProactiveInput & {
    senderRelationships?: SenderRelationship[];
    threadMessages?: AnalyzeProactiveInput["row"][];
  },
): ProactiveAssistantResult {
  const locale = input.locale ?? "en";
  const category = (input.row.category ?? "worth_your_attention") as InboxAiCategory;
  const hay = `${input.row.sender} ${input.row.subject} ${input.row.snippet}`;
  const days = daysSince(input.row.internalDateMs);

  const relationship = resolveSenderRelationship(
    input.row,
    category,
    input.senderRelationships ?? [],
  );

  const action = analyzeActionIntelligence({
    row: input.row,
    category,
    extraBody: input.extraBody,
    locale,
  });

  const followUp = analyzeFollowUp(input.row as GmailInboxRow, category, {
    senderRelationships: input.senderRelationships,
  });

  const timeline = analyzeTimelineIntelligence({
    row: toThreadSnapshot({ ...input.row, threadId: input.row.threadId ?? input.row.id, category }),
    extraBody: input.extraBody,
    threadMessages: input.threadMessages?.map((m) =>
      toThreadSnapshot({ ...m, threadId: m.threadId ?? m.id, category: m.category }),
    ),
    locale,
  });

  const stalled = detectStalledSignals(input.row, category);
  const commitments = detectUpcomingCommitments(hay, input.row.subject, category);
  const incomplete = detectIncompleteActions(input.row, input.extraBody, {
    daysSinceMessage: days,
    awaitingUser: followUp?.state === "awaiting_your_reply",
    category,
  });

  let baseUrgency = 35;
  if (action.actionable) baseUrgency += 12;
  if (followUp) baseUrgency += followUp.urgencyScore * 0.35;
  if (timeline.active) baseUrgency += timeline.visibilityBoost;

  const urgencyScore = scoreProactiveUrgency({
    baseScore: baseUrgency,
    relationship,
    daysSinceMessage: days,
    escalationScore: timeline.escalationScore,
    followUpUrgency: followUp?.urgencyScore,
    category,
    hasFinancialSignal: FINANCIAL.test(hay) || stalled.pendingPayment,
    hasSchoolFamilySignal: SCHOOL_FAMILY.test(hay) || relationship?.kind === "school",
  });

  const meetingTomorrow = commitments.some(
    (c) => c.whenHint === "tomorrow" || /tomorrow|domani/i.test(c.description),
  );
  const travelDetected = commitments.some((c) =>
    /travel/i.test(c.description),
  );

  const suggestions = sortSuggestions(
    buildProactiveSuggestions({
      emailId: input.row.id,
      threadId: input.row.threadId,
      sender: input.row.sender,
      subject: input.row.subject,
      commitments,
      incomplete,
      locale,
      urgencyScore,
      options: {
        isVip:
          relationship?.importance === "vip" ||
          relationship?.kind === "vip_client",
        daysSince: days,
        meetingTomorrow,
        travelDetected,
      },
    }),
  ).slice(0, 4);

  const active =
    suggestions.length > 0 &&
    urgencyScore >= 40 &&
    category !== "promotions" &&
    category !== "newsletters";

  return {
    active,
    suggestions,
    urgencyScore,
    upcomingCommitments: commitments,
    incompleteActions: incomplete,
  };
}

export function summarizeProactiveAssistant(
  result: ProactiveAssistantResult,
): ProactiveAssistantSummary {
  return {
    active: result.active,
    topSuggestion: result.suggestions[0] ?? null,
    suggestionCount: result.suggestions.length,
    urgencyScore: result.urgencyScore,
  };
}

export function analyzeProactiveAssistantInbox(
  rows: Array<AnalyzeProactiveInput["row"] & { category?: InboxAiCategory }>,
  options?: {
    senderRelationships?: SenderRelationship[];
    locale?: "en" | "it";
    maxSuggestions?: number;
  },
): ProactiveSuggestion[] {
  const locale = options?.locale ?? "en";
  const max = options?.maxSuggestions ?? 5;
  const all: ProactiveSuggestion[] = [];

  for (const row of rows) {
    const threadSiblings = rows.filter(
      (m) => (m.threadId ?? m.id) === (row.threadId ?? row.id),
    );
    const result = analyzeProactiveAssistant({
      row,
      locale,
      senderRelationships: options?.senderRelationships,
      threadMessages: threadSiblings,
    });
    if (result.active) {
      all.push(...result.suggestions);
    }
  }

  const seen = new Set<string>();
  return sortSuggestions(all)
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .slice(0, max);
}

export function formatProactiveForPrompt(
  suggestions: ProactiveSuggestion[],
): string {
  if (!suggestions.length) return "";
  const lines = suggestions.slice(0, 2).map((s) => `- ${s.message}`);
  return `Proactive assistant (suggestions only — user must approve any action):\n${lines.join("\n")}\nNever send or complete tasks automatically.`;
}
