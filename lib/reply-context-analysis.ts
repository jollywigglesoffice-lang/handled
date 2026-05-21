import {
  analyzeActionIntelligence,
  formatActionIntelligenceForPrompt,
  type ActionIntelligenceResult,
} from "@/lib/action-intelligence";
import {
  analyzeDecisionAssistance,
  formatDecisionAssistanceForPrompt,
  type DecisionAssistanceResult,
} from "@/lib/decision-assistance";
import {
  analyzeProactiveAssistant,
  formatProactiveForPrompt,
  type ProactiveAssistantResult,
} from "@/lib/proactive-assistant";
import {
  analyzeTimelineIntelligence,
  formatTimelineForPrompt,
} from "@/lib/timeline-intelligence";
import { toThreadSnapshot } from "@/lib/timeline-intelligence/thread-group";
import {
  buildCalendarAwareness,
  expectedSchedulingAction,
  schedulingReplyDirective,
  readCalendarConnectionState,
} from "@/lib/calendar-awareness";
import {
  analyzeEmailIntent,
  type EmailIntentAnalysis,
  type EmailIntentKind,
} from "@/lib/email-intent";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { assessReplyNeed, type ReplyNeedAssessment } from "@/lib/reply-necessity";
import { relationshipReplyDirective } from "@/lib/relationship-intelligence/effects";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { WorkflowMode } from "@/lib/workflow-mode";

export type ReplyEmailType =
  | "inbound_sales"
  | "support"
  | "scheduling"
  | "personal"
  | "fyi"
  | "confirmation"
  | "promotional"
  | "conversation"
  | "unknown";

export type PrimaryReplyIntent =
  | EmailIntentKind
  | "personal_conversation"
  | "fyi_no_action"
  | "confirmation"
  | "unsubscribe"
  | "urgent_request"
  | "general";

export type ReplyContextAnalysis = {
  replyNeeded: boolean;
  replyNeed: ReplyNeedAssessment;
  intent: EmailIntentAnalysis;
  primaryIntent: PrimaryReplyIntent;
  emailType: ReplyEmailType;
  hasDirectQuestion: boolean;
  questionCount: number;
  expectedAction: string;
  replyStyle: string;
  forbidsGenericAckOnly: boolean;
  extractedFacts: {
    senderFirstName?: string;
    employeeCount?: number;
    productMentions: string[];
  };
  relationship?: SenderRelationshipProfile;
  calendarAwareness?: ReturnType<typeof buildCalendarAwareness>;
  actionIntelligence?: ActionIntelligenceResult;
  timelineIntelligence?: ReturnType<typeof analyzeTimelineIntelligence>;
  proactiveAssistant?: ProactiveAssistantResult;
  decisionAssistance?: DecisionAssistanceResult;
  logSummary: Record<string, unknown>;
};

const UNSUBSCRIBE = /unsubscribe|opt.?out|remove me from|stop (?:sending|emailing)/i;
const PERSONAL =
  /^(?:hi|hey|hello)\s+\w+[,!]?\s*(?:how are you|hope you(?:'re| are)|great (?:to|hearing)|wanted to reach out personally)/im;
const CONFIRMATION = /^(?:confirmed|sounds good|works for me|see you then|got it)[\s.!]*$/im;
const URGENT = /urgent|asap|immediately|time.?sensitive|need (?:this|it) (?:today|now|asap)/i;
const FYI =
  /(?:for your (?:info|reference)|fyi|no action needed|just (?:wanted to )?let you know|heads up)/i;

function rowFromEmail(input: {
  email: string;
  sender?: string;
  subject?: string;
}): GmailInboxRow {
  const body = input.email.trim();
  const subject = input.subject?.trim() || body.split("\n")[0]?.slice(0, 120) || "";
  return {
    id: "reply-context",
    threadId: "reply-context",
    sender: input.sender ?? "",
    subject,
    snippet: body.slice(0, 4000),
    date: new Date().toISOString(),
    internalDateMs: Date.now(),
  };
}

export function extractSenderFirstName(senderHeader: string, emailBody: string): string | undefined {
  const fromMatch = senderHeader.match(/^["']?([^"'<@]+?)["']?\s*(?:<|$)/);
  if (fromMatch?.[1]) {
    const part = fromMatch[1].trim().split(/\s+/)[0];
    if (part && part.length > 1 && !/noreply|no-reply|notification/i.test(part)) {
      return part;
    }
  }

  const signoff = emailBody.match(
    /(?:^|\n)(?:best|thanks|regards|cheers),?\s*\n?\s*([A-Z][a-z]{1,20})\s*$/m,
  );
  if (signoff?.[1]) return signoff[1];

  return undefined;
}

function extractEmployeeCount(text: string): number | undefined {
  const m =
    text.match(/(\d{1,5})\s*(?:\+)?\s*employees?/i) ??
    text.match(/team of\s*(\d{1,5})/i) ??
    text.match(/(\d{1,5})\s*(?:\+)?\s*(?:seats|users)/i);
  if (m?.[1]) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n < 100_000) return n;
  }
  return undefined;
}

function extractProductMentions(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /handled\s*app/gi,
    /corporate pricing/gi,
    /enterprise(?:\s+plan)?/gi,
    /early access/gi,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) found.push(...m.map((s) => s.trim()));
  }
  return [...new Set(found)].slice(0, 5);
}

function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function resolvePrimaryIntent(
  intent: EmailIntentAnalysis,
  hay: string,
): PrimaryReplyIntent {
  if (UNSUBSCRIBE.test(hay)) return "unsubscribe";
  if (URGENT.test(hay) || intent.kinds.includes("deadline")) return "urgent_request";
  if (intent.kinds.includes("pricing_inquiry")) return "pricing_inquiry";
  if (intent.kinds.includes("sales_lead")) return "sales_lead";
  if (intent.kinds.includes("scheduling")) return "scheduling";
  if (intent.kinds.includes("support_request")) return "support_request";
  if (intent.kinds.includes("partnership")) return "partnership";
  if (intent.kinds.includes("decision_required")) return "decision_required";
  if (intent.kinds.includes("information_request")) return "information_request";
  if (intent.kinds.includes("direct_question")) return "direct_question";
  if (CONFIRMATION.test(hay.trim())) return "confirmation";
  if (FYI.test(hay) && countQuestions(hay) === 0) return "fyi_no_action";
  if (PERSONAL.test(hay)) return "personal_conversation";
  return intent.kinds[0] ?? "general";
}

function resolveEmailType(
  primary: PrimaryReplyIntent,
  category: InboxAiCategory,
): ReplyEmailType {
  if (primary === "pricing_inquiry" || primary === "sales_lead" || primary === "partnership") {
    return "inbound_sales";
  }
  if (primary === "support_request") return "support";
  if (primary === "scheduling") return "scheduling";
  if (primary === "personal_conversation") return "personal";
  if (primary === "confirmation") return "confirmation";
  if (primary === "fyi_no_action") return "fyi";
  if (category === "promotion" || category === "newsletter") return "promotional";
  if (primary === "direct_question" || primary === "general") return "conversation";
  return "unknown";
}

function expectedActionFor(primary: PrimaryReplyIntent, facts: ReplyContextAnalysis["extractedFacts"]): string {
  switch (primary) {
    case "pricing_inquiry":
      return facts.employeeCount
        ? `Offer corporate/team pricing and confirm you can send details for ~${facts.employeeCount} employees.`
        : "Offer corporate or team pricing and commit to sending pricing details.";
    case "sales_lead":
      return "Acknowledge interest, welcome them, and propose a clear next step (pricing, demo, or call).";
    case "scheduling":
      return "Draft scheduling options only — user must approve before any time is confirmed.";
    case "support_request":
      return "Acknowledge the issue and state what you will do to help.";
    case "unsubscribe":
      return "Confirm removal or preference update — no marketing pitch.";
    case "direct_question":
      return "Answer each question directly or commit to a specific follow-up.";
    case "information_request":
      return "Provide or promise the requested information.";
    case "decision_required":
      return "Give a clear decision, approval, or what you need to decide.";
    case "fyi_no_action":
      return "Brief acknowledgment only if needed — no false urgency.";
    case "confirmation":
      return "Confirm agreement briefly.";
    case "urgent_request":
      return "Acknowledge urgency and state immediate next step.";
    default:
      return "Continue the thread naturally — address what they wrote, not just receipt.";
  }
}

function replyStyleFor(
  primary: PrimaryReplyIntent,
  tone: string,
  workflowMode?: WorkflowMode,
): string {
  const base = `Tone: ${tone}. Write as a proactive executive assistant — decisive, helpful, specific.`;
  const mode =
    workflowMode === "handle"
      ? "Draft send-ready replies with a clear next step."
      : workflowMode === "clean"
        ? "Keep replies minimal but still answer the ask."
        : "Offer helpful options the user can send with light edits.";

  const intentStyle: Record<string, string> = {
    pricing_inquiry:
      "Sales-assist style: thank them, reference team size if mentioned, offer to send corporate/enterprise pricing.",
    sales_lead: "Opportunity style: warm interest, invite next step (pricing sheet, demo, call).",
    direct_question: "Q&A style: answer or explicitly commit to answer each question.",
    scheduling:
      "Coordinator style: suggest tentative times or next steps — never confirm availability without user approval.",
    support_request: "Support style: empathy + action.",
    unsubscribe: "Compliance style: confirm opt-out, no upsell.",
    fyi_no_action: "Brief acknowledgment only when appropriate.",
  };

  return `${base} ${mode} ${intentStyle[primary] ?? "Conversation style: respond to substance, not receipt."}`;
}

export function analyzeReplyContext(input: {
  email: string;
  sender?: string;
  subject?: string;
  category?: InboxAiCategory;
  workflowMode?: WorkflowMode;
  relationship?: SenderRelationshipProfile | null;
}): ReplyContextAnalysis {
  const row = rowFromEmail(input);
  const hay = `${row.sender} ${row.subject} ${row.snippet}`.toLowerCase();
  const intent = analyzeEmailIntent(row);
  const calendarAwareness = buildCalendarAwareness(row, input.email);
  const actionIntelligence = analyzeActionIntelligence({
    row,
    category: input.category,
    extraBody: input.email,
  });
  const timelineIntelligence = analyzeTimelineIntelligence({
    row: toThreadSnapshot(row),
    extraBody: input.email,
  });
  const proactiveAssistant = analyzeProactiveAssistant({
    row: {
      id: row.id,
      threadId: row.threadId,
      sender: row.sender,
      subject: row.subject,
      snippet: row.snippet,
      internalDateMs: row.internalDateMs,
      category: input.category,
    },
    extraBody: input.email,
  });
  const decisionAssistance = analyzeDecisionAssistance({
    row: {
      id: row.id,
      threadId: row.threadId,
      sender: row.sender,
      subject: row.subject,
      snippet: row.snippet,
      internalDateMs: row.internalDateMs,
      category: input.category,
    },
    extraBody: input.email,
  });
  const category = input.category ?? "needs_attention";
  const replyNeed = assessReplyNeed({
    row,
    category,
    workflowMode: input.workflowMode ?? "assist",
  });

  const questionCount = countQuestions(input.email);
  const hasDirectQuestion = questionCount > 0 || intent.kinds.includes("direct_question");
  const primaryIntent = resolvePrimaryIntent(intent, hay);
  const emailType = resolveEmailType(primaryIntent, category);

  const extractedFacts = {
    senderFirstName: extractSenderFirstName(input.sender ?? "", input.email),
    employeeCount: extractEmployeeCount(input.email),
    productMentions: extractProductMentions(input.email),
  };

  let expectedAction = expectedActionFor(primaryIntent, extractedFacts);
  if (primaryIntent === "scheduling" || calendarAwareness.schedulingIntent.detected) {
    expectedAction = expectedSchedulingAction(
      calendarAwareness.schedulingIntent,
      readCalendarConnectionState().status,
    );
  }
  if (actionIntelligence.suggestedNextAction && actionIntelligence.actionable) {
    expectedAction = actionIntelligence.suggestedNextAction;
  }
  const forbidsGenericAckOnly =
    hasDirectQuestion ||
    primaryIntent === "pricing_inquiry" ||
    primaryIntent === "sales_lead" ||
    primaryIntent === "information_request" ||
    primaryIntent === "support_request" ||
    primaryIntent === "scheduling" ||
    primaryIntent === "decision_required";

  const replyNeeded = replyNeed.recommended || intent.requiresReply;

  const analysis: ReplyContextAnalysis = {
    replyNeeded,
    replyNeed,
    intent,
    primaryIntent,
    emailType,
    hasDirectQuestion,
    questionCount,
    expectedAction,
    replyStyle: replyStyleFor(primaryIntent, "balanced", input.workflowMode),
    forbidsGenericAckOnly,
    extractedFacts,
    relationship: input.relationship ?? undefined,
    calendarAwareness,
    actionIntelligence,
    timelineIntelligence,
    proactiveAssistant,
    decisionAssistance,
    logSummary: {
      replyNeeded,
      primaryIntent,
      emailType,
      hasDirectQuestion,
      questionCount,
      intentKinds: intent.kinds,
      expectedAction,
      forbidsGenericAckOnly,
      extractedFacts,
      replyNeedReason: replyNeed.reason,
    },
  };

  return analysis;
}

export function logReplyContextAnalysis(ctx: ReplyContextAnalysis, reason: string): void {
  console.log(`[reply-context] ${reason}:`, ctx.logSummary);
}

export function formatReplyContextForPrompt(
  ctx: ReplyContextAnalysis,
  tone: string,
  languageLabel: string,
  workflowMode?: WorkflowMode,
): string {
  const facts: string[] = [];
  if (ctx.extractedFacts.senderFirstName) {
    facts.push(`Sender's first name (use in greeting): ${ctx.extractedFacts.senderFirstName}`);
  }
  if (ctx.extractedFacts.employeeCount) {
    facts.push(`Team size mentioned: ${ctx.extractedFacts.employeeCount} employees`);
  }
  if (ctx.extractedFacts.productMentions.length) {
    facts.push(`Products/topics mentioned: ${ctx.extractedFacts.productMentions.join(", ")}`);
  }

  const forbidden = ctx.forbidsGenericAckOnly
    ? `
FORBIDDEN (do not use unless email is pure FYI with no questions):
- "Thanks for sending this over"
- "This looks good to me"
- "Happy to proceed" / "I'm aligned"
- "Got it, thanks" without answering their ask
- Any reply that only acknowledges receipt without addressing their request`
    : "";

  return `
## Pre-analysis (follow strictly)
- Reply needed: ${ctx.replyNeeded ? "yes" : "no"} — ${ctx.replyNeed.reason}
- Primary intent: ${ctx.primaryIntent.replace(/_/g, " ")}
- Email type: ${ctx.emailType}
- Direct question(s): ${ctx.hasDirectQuestion ? `yes (${ctx.questionCount})` : "no"}
- Expected action: ${ctx.expectedAction}
- ${replyStyleFor(ctx.primaryIntent, tone, workflowMode)}
- Language: ${languageLabel}
${facts.length ? `- Facts to reference:\n${facts.map((f) => `  - ${f}`).join("\n")}` : ""}
${forbidden}
${ctx.relationship ? `\n${relationshipReplyDirective(ctx.relationship)}` : ""}
${
  ctx.calendarAwareness?.schedulingIntent.detected
    ? `\n${schedulingReplyDirective(
        ctx.calendarAwareness.schedulingIntent,
        readCalendarConnectionState().status,
      )}`
    : ""
}
${
  ctx.actionIntelligence
    ? `\n${formatActionIntelligenceForPrompt(ctx.actionIntelligence)}`
    : ""
}
${ctx.timelineIntelligence ? `\n${formatTimelineForPrompt(ctx.timelineIntelligence)}` : ""}
${
  ctx.proactiveAssistant?.active
    ? `\n${formatProactiveForPrompt(ctx.proactiveAssistant.suggestions)}`
    : ""
}
${
  ctx.decisionAssistance?.active
    ? `\n${formatDecisionAssistanceForPrompt(ctx.decisionAssistance)}`
    : ""
}
`.trim();
}
