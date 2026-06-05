import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import type {
  CompletionLearningPattern,
  CompletionLearningStats,
} from "@/lib/completion-learning/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";

const MAX_PATTERNS = 400;

function subjectKeywords(subject: string): string[] {
  const cleaned = subject
    .replace(/^(re|fwd?):\s*/gi, "")
    .replace(/[^\w\s]/g, " ")
    .trim();
  return cleaned
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^\d+$/.test(w))
    .slice(0, 2)
    .map((w) => w.toLowerCase());
}

function patternKey(p: Pick<CompletionLearningPattern, "actionId" | "category" | "senderDomain" | "subjectKeyword">): string {
  return [p.actionId, p.category ?? "", p.senderDomain ?? "", p.subjectKeyword ?? ""].join("|");
}

function bumpPattern(
  patterns: CompletionLearningPattern[],
  partial: Omit<CompletionLearningPattern, "count" | "lastUsedAt">,
  now: number,
): CompletionLearningPattern[] {
  const key = patternKey(partial);
  const idx = patterns.findIndex((p) => patternKey(p) === key);
  if (idx >= 0) {
    const next = [...patterns];
    const row = next[idx]!;
    next[idx] = { ...row, count: row.count + 1, lastUsedAt: now };
    return next;
  }
  return [...patterns, { ...partial, count: 1, lastUsedAt: now }];
}

export function recordCompletionLearning(
  stats: CompletionLearningStats,
  record: EmailCompletionRecord,
): CompletionLearningStats {
  const now = record.completedAt;
  const domain = record.senderDomain ?? resolveSenderIdentity(record.sender).domain ?? undefined;
  const keywords = subjectKeywords(record.subject);

  let patterns = [...stats.patterns];

  patterns = bumpPattern(patterns, {
    actionId: record.actionId,
    category: record.category,
  }, now);

  if (domain) {
    patterns = bumpPattern(patterns, {
      actionId: record.actionId,
      category: record.category,
      senderDomain: domain,
    }, now);
  }

  for (const subjectKeyword of keywords) {
    patterns = bumpPattern(patterns, {
      actionId: record.actionId,
      category: record.category,
      subjectKeyword,
    }, now);
  }

  patterns.sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt);
  if (patterns.length > MAX_PATTERNS) {
    patterns = patterns.slice(0, MAX_PATTERNS);
  }

  return { version: 1, patterns };
}

export function parseCompletionLearningJson(raw: unknown): CompletionLearningStats {
  if (!raw || typeof raw !== "object") return { version: 1, patterns: [] };
  const row = raw as { version?: number; patterns?: unknown };
  if (!Array.isArray(row.patterns)) return { version: 1, patterns: [] };

  const patterns: CompletionLearningPattern[] = [];
  for (const item of row.patterns) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (typeof p.actionId !== "string" || typeof p.count !== "number") continue;
    patterns.push({
      actionId: p.actionId as CompletionLearningPattern["actionId"],
      category: typeof p.category === "string" ? (p.category as CompletionLearningPattern["category"]) : undefined,
      senderDomain: typeof p.senderDomain === "string" ? p.senderDomain : undefined,
      subjectKeyword: typeof p.subjectKeyword === "string" ? p.subjectKeyword : undefined,
      count: p.count,
      lastUsedAt: typeof p.lastUsedAt === "number" ? p.lastUsedAt : Date.now(),
    });
  }

  return { version: 1, patterns };
}
