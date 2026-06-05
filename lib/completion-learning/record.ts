import { completionPatternConfidence } from "@/lib/completion-learning/confidence";
import {
  formatCompletionPattern,
  patternRowKey,
  patternSignalKey,
  subjectKeywordsForLearning,
  type CompletionPatternSignal,
} from "@/lib/completion-learning/pattern";
import type {
  CompletionLearningEvent,
  CompletionLearningExample,
  CompletionLearningPattern,
  CompletionLearningStats,
} from "@/lib/completion-learning/types";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";

const MAX_PATTERNS = 400;
const MAX_EVENTS = 500;
const MAX_EXAMPLES_PER_PATTERN = 3;

function appendExample(
  examples: CompletionLearningExample[],
  record: EmailCompletionRecord,
): CompletionLearningExample[] {
  const next: CompletionLearningExample = {
    emailId: record.emailId,
    sender: record.sender,
    subject: record.subject,
    completedAt: record.completedAt,
  };
  return [next, ...examples.filter((e) => e.emailId !== record.emailId)].slice(
    0,
    MAX_EXAMPLES_PER_PATTERN,
  );
}

function bumpPattern(
  patterns: CompletionLearningPattern[],
  signal: CompletionPatternSignal,
  record: EmailCompletionRecord,
): CompletionLearningPattern[] {
  const key = patternSignalKey(signal);
  const idx = patterns.findIndex((p) => patternRowKey(p) === key);
  const now = record.completedAt;

  if (idx >= 0) {
    const next = [...patterns];
    const row = next[idx]!;
    const sampleCount = row.sampleCount + 1;
    next[idx] = {
      ...row,
      sampleCount,
      confidence: completionPatternConfidence(sampleCount),
      examples: appendExample(row.examples, record),
      lastUsedAt: now,
    };
    return next;
  }

  const sampleCount = 1;
  return [
    ...patterns,
    {
      completionPattern: formatCompletionPattern(signal),
      scope: signal.scope,
      actionId: signal.actionId,
      category: signal.category,
      senderDomain: signal.senderDomain,
      senderRuleKey: signal.senderRuleKey,
      subjectKeyword: signal.subjectKeyword,
      sampleCount,
      confidence: completionPatternConfidence(sampleCount),
      examples: appendExample([], record),
      lastUsedAt: now,
    },
  ];
}

function appendEvent(
  events: CompletionLearningEvent[],
  record: EmailCompletionRecord,
  senderRuleKey: string,
): CompletionLearningEvent[] {
  const event: CompletionLearningEvent = {
    emailId: record.emailId,
    sender: record.sender,
    senderDomain: record.senderDomain,
    senderRuleKey,
    category: record.category,
    actionId: record.actionId,
    actionLabel: record.actionLabel,
    completedAt: record.completedAt,
  };
  return [event, ...events.filter((e) => e.emailId !== record.emailId)].slice(0, MAX_EVENTS);
}

export type CompletionLearningRecordResult = {
  stats: CompletionLearningStats;
  /** Patterns whose sampleCount increased this call. */
  updatedPatterns: CompletionLearningPattern[];
};

export function recordCompletionLearning(
  stats: CompletionLearningStats,
  record: EmailCompletionRecord,
): CompletionLearningStats {
  return recordCompletionLearningWithMeta(stats, record).stats;
}

export function recordCompletionLearningWithMeta(
  stats: CompletionLearningStats,
  record: EmailCompletionRecord,
): CompletionLearningRecordResult {
  const identity = resolveSenderIdentity(record.sender);
  const domain = record.senderDomain ?? identity.domain ?? undefined;
  const ruleKey = identity.ruleKey || undefined;
  const keywords = subjectKeywordsForLearning(record.subject);

  let patterns = [...stats.patterns];
  const touchedKeys = new Set<string>();

  const bump = (signal: CompletionPatternSignal) => {
    const before = patterns.find((p) => patternRowKey(p) === patternSignalKey(signal));
    patterns = bumpPattern(patterns, signal, record);
    const after = patterns.find((p) => patternRowKey(p) === patternSignalKey(signal));
    if (after && (!before || after.sampleCount > before.sampleCount)) {
      touchedKeys.add(patternRowKey(after));
    }
  };

  bump({ scope: "global", actionId: record.actionId });
  bump({ scope: "category", actionId: record.actionId, category: record.category });

  if (ruleKey) {
    bump({ scope: "sender", actionId: record.actionId, senderRuleKey: ruleKey });
  }

  if (domain) {
    bump({ scope: "sender_domain", actionId: record.actionId, senderDomain: domain });
    bump({
      scope: "category_domain",
      actionId: record.actionId,
      category: record.category,
      senderDomain: domain,
    });
  }

  for (const subjectKeyword of keywords) {
    bump({
      scope: "subject_keyword",
      actionId: record.actionId,
      subjectKeyword,
    });
    bump({
      scope: "category_keyword",
      actionId: record.actionId,
      category: record.category,
      subjectKeyword,
    });
  }

  patterns.sort(
    (a, b) =>
      b.sampleCount - a.sampleCount || b.confidence - a.confidence || b.lastUsedAt - a.lastUsedAt,
  );
  if (patterns.length > MAX_PATTERNS) {
    patterns = patterns.slice(0, MAX_PATTERNS);
  }

  const events = appendEvent(stats.events ?? [], record, identity.ruleKey);

  const updatedPatterns = patterns.filter((p) => touchedKeys.has(patternRowKey(p)));

  return {
    stats: { version: 2, patterns, events },
    updatedPatterns,
  };
}

type LegacyPattern = {
  actionId?: string;
  category?: string;
  senderDomain?: string;
  subjectKeyword?: string;
  count?: number;
  lastUsedAt?: number;
};

function migrateLegacyPattern(raw: LegacyPattern): CompletionLearningPattern | null {
  if (typeof raw.actionId !== "string" || typeof raw.count !== "number") return null;

  let scope: CompletionLearningPattern["scope"] = "global";
  if (raw.subjectKeyword && raw.category) scope = "category_keyword";
  else if (raw.subjectKeyword) scope = "subject_keyword";
  else if (raw.senderDomain && raw.category) scope = "category_domain";
  else if (raw.senderDomain) scope = "sender_domain";
  else if (raw.category) scope = "category";

  const signal: CompletionPatternSignal = {
    scope,
    actionId: raw.actionId as CompletionLearningPattern["actionId"],
    category:
      typeof raw.category === "string"
        ? (raw.category as CompletionLearningPattern["category"])
        : undefined,
    senderDomain: typeof raw.senderDomain === "string" ? raw.senderDomain : undefined,
    subjectKeyword: typeof raw.subjectKeyword === "string" ? raw.subjectKeyword : undefined,
  };

  const sampleCount = raw.count;
  return {
    completionPattern: formatCompletionPattern(signal),
    scope,
    actionId: signal.actionId,
    category: signal.category,
    senderDomain: signal.senderDomain,
    subjectKeyword: signal.subjectKeyword,
    sampleCount,
    confidence: completionPatternConfidence(sampleCount),
    examples: [],
    lastUsedAt: typeof raw.lastUsedAt === "number" ? raw.lastUsedAt : Date.now(),
  };
}

export function parseCompletionLearningJson(raw: unknown): CompletionLearningStats {
  if (!raw || typeof raw !== "object") return { version: 2, patterns: [], events: [] };
  const row = raw as {
    version?: number;
    patterns?: unknown;
    events?: unknown;
  };

  const patterns: CompletionLearningPattern[] = [];
  if (Array.isArray(row.patterns)) {
    for (const item of row.patterns) {
      if (!item || typeof item !== "object") continue;
      const p = item as Record<string, unknown>;

      if (typeof p.sampleCount === "number" && typeof p.completionPattern === "string") {
        patterns.push({
          completionPattern: p.completionPattern,
          scope: (typeof p.scope === "string"
            ? p.scope
            : "global") as CompletionLearningPattern["scope"],
          actionId: p.actionId as CompletionLearningPattern["actionId"],
          category:
            typeof p.category === "string"
              ? (p.category as CompletionLearningPattern["category"])
              : undefined,
          senderDomain: typeof p.senderDomain === "string" ? p.senderDomain : undefined,
          senderRuleKey: typeof p.senderRuleKey === "string" ? p.senderRuleKey : undefined,
          subjectKeyword: typeof p.subjectKeyword === "string" ? p.subjectKeyword : undefined,
          sampleCount: p.sampleCount,
          confidence:
            typeof p.confidence === "number"
              ? p.confidence
              : completionPatternConfidence(p.sampleCount),
          examples: Array.isArray(p.examples)
            ? (p.examples as CompletionLearningExample[]).filter(
                (e) => e && typeof e.emailId === "string",
              )
            : [],
          lastUsedAt: typeof p.lastUsedAt === "number" ? p.lastUsedAt : Date.now(),
        });
        continue;
      }

      const migrated = migrateLegacyPattern(p as LegacyPattern);
      if (migrated) patterns.push(migrated);
    }
  }

  const events: CompletionLearningEvent[] = [];
  if (Array.isArray(row.events)) {
    for (const item of row.events) {
      if (!item || typeof item !== "object") continue;
      const e = item as Record<string, unknown>;
      if (typeof e.emailId !== "string" || typeof e.actionId !== "string") continue;
      events.push({
        emailId: e.emailId,
        sender: typeof e.sender === "string" ? e.sender : "",
        senderDomain: typeof e.senderDomain === "string" ? e.senderDomain : undefined,
        senderRuleKey: typeof e.senderRuleKey === "string" ? e.senderRuleKey : "",
        category:
          typeof e.category === "string"
            ? (e.category as CompletionLearningEvent["category"])
            : "needs_attention",
        actionId: e.actionId as CompletionLearningEvent["actionId"],
        actionLabel: typeof e.actionLabel === "string" ? e.actionLabel : e.actionId,
        completedAt: typeof e.completedAt === "number" ? e.completedAt : Date.now(),
      });
    }
  }

  return { version: 2, patterns, events };
}
