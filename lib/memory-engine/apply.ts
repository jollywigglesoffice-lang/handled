import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import type { GmailInboxRow } from "@/lib/gmail-api";
import { resolveSenderIdentity } from "@/lib/sender-identity";
import { applyUserRulesPre } from "@/lib/inbox-user-rules/apply";
import {
  parseSenderDomain,
  sortRulesForPhase,
} from "@/lib/inbox-user-rules/match";
import { meetsAutoApplyTrust } from "@/lib/memory-engine/learning";
import {
  normalizeMemoryEngineSnapshot,
  safeMemoryRecords,
} from "@/lib/memory-engine/normalize";
import {
  MEMORY_CORRECTION_HISTORY_THRESHOLD,
  type CategoryCorrectionRecord,
  type MemoryEngineSnapshot,
  type SenderMemoryRecord,
} from "@/lib/memory-engine/types";
import { extractTopicKeywords } from "@/lib/memory-engine/topic";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

const SENDER_MEMORY_PRIORITY = 620;
const CORRECTION_HISTORY_PRIORITY = 580;
const PATTERN_MEMORY_PRIORITY = 540;
const PATTERN_RULE_PREFIX = "memory-pattern-";

function parsePatternRuleId(ruleId: string): { domain: string; keyword: string } | null {
  if (!ruleId.startsWith(PATTERN_RULE_PREFIX)) return null;
  const rest = ruleId.slice(PATTERN_RULE_PREFIX.length);
  const dashIdx = rest.lastIndexOf("-");
  if (dashIdx <= 0) return null;
  return { domain: rest.slice(0, dashIdx), keyword: rest.slice(dashIdx + 1) };
}

/** Sender trust memory — applies when trust_score meets threshold. */
export function memorySenderRulesToInboxRules(
  inputRecords: SenderMemoryRecord[] | null | undefined,
): InboxUserRule[] {
  const records = safeMemoryRecords(inputRecords);
  return records
    .filter((r) => meetsAutoApplyTrust(r.trustScore))
    .map((record, index) => {
      const senderHint =
        record.senderEmail && record.senderEmail.includes("@")
          ? record.senderEmail
          : record.senderDomain
            ? `placeholder <x@${record.senderDomain}>`
            : "unknown";
      const identity = resolveSenderIdentity(senderHint);
      const match =
        identity.email && identity.email.includes("@")
          ? ({ type: "sender_email" as const, value: identity.email })
          : record.senderDomain
            ? ({ type: "sender_domain" as const, value: record.senderDomain })
            : ({ type: "sender_contains" as const, value: identity.ruleKey });

      return {
        id: `memory-sender-${record.senderEmail ?? ""}-${record.senderDomain ?? ""}-${index}`,
        enabled: true,
        priority: SENDER_MEMORY_PRIORITY - index,
        phase: "pre",
        label: `Memory sender: ${record.preferredCategory.replace(/_/g, " ")} (trust ${Math.round(record.trustScore * 100)}%)`,
        match,
        action: { type: "force_category", category: record.preferredCategory },
      };
    });
}

/** Repeated correction history per sender. */
export function correctionHistoryRulesToInboxRules(
  inputRecords: CategoryCorrectionRecord[] | null | undefined,
): InboxUserRule[] {
  const records = safeMemoryRecords(inputRecords);
  return records
    .filter((r) => r.correctionCount >= MEMORY_CORRECTION_HISTORY_THRESHOLD)
    .map((record, index) => {
      const senderHint =
        record.senderEmail && record.senderEmail.includes("@")
          ? record.senderEmail
          : record.senderDomain
            ? `placeholder <x@${record.senderDomain}>`
            : record.sender ?? "unknown";
      const identity = resolveSenderIdentity(senderHint);
      const match =
        identity.email && identity.email.includes("@")
          ? ({ type: "sender_email" as const, value: identity.email })
          : record.senderDomain
            ? ({ type: "sender_domain" as const, value: record.senderDomain })
            : ({ type: "sender_contains" as const, value: identity.ruleKey });

      return {
        id: `memory-correction-${record.senderEmail ?? ""}-${record.senderDomain ?? ""}-${index}`,
        enabled: true,
        priority: CORRECTION_HISTORY_PRIORITY - index,
        phase: "pre",
        label: `Correction history: ${record.userCategory.replace(/_/g, " ")} (${record.correctionCount}×)`,
        match,
        action: { type: "force_category", category: record.userCategory },
      };
    });
}

/** Topic + domain patterns from repeated corrections. */
export function memoryCategoryRulesToInboxRules(
  snapshot: MemoryEngineSnapshot | null | undefined,
): InboxUserRule[] {
  const safe = normalizeMemoryEngineSnapshot(snapshot ?? undefined);
  return safe.categoryPatterns.map((pattern, index) => ({
    id: `memory-pattern-${pattern.senderDomain}-${pattern.subjectKeyword}`,
    enabled: true,
    priority: PATTERN_MEMORY_PRIORITY - index,
    phase: "pre",
    label: `Memory topic: ${pattern.subjectKeyword} → ${pattern.category}`,
    match: {
      type: "subject_contains",
      value: pattern.subjectKeyword,
    },
    action: { type: "force_category", category: pattern.category },
  }));
}

export function memoryRulesFromSnapshot(
  snapshot: MemoryEngineSnapshot | null | undefined,
): InboxUserRule[] {
  try {
    const safe = normalizeMemoryEngineSnapshot(snapshot ?? undefined);
    return [
      ...memorySenderRulesToInboxRules(safe.senderMemory),
      ...correctionHistoryRulesToInboxRules(safe.categoryCorrections),
      ...memoryCategoryRulesToInboxRules(safe),
    ];
  } catch (error) {
    console.warn("[memory-engine] memoryRulesFromSnapshot failed — using empty rules", error);
    return [];
  }
}

function rulesWithPrefix(rules: InboxUserRule[] | null | undefined, prefix: string): InboxUserRule[] {
  return safeMemoryRecords(rules).filter((r) => r.id.startsWith(prefix));
}

export function lookupSenderMemoryCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  memoryRules: InboxUserRule[],
): InboxAiCategory | null {
  return lookupMemoryCategory(row, rulesWithPrefix(memoryRules, "memory-sender-"));
}

export function lookupCorrectionHistoryCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  memoryRules: InboxUserRule[],
): InboxAiCategory | null {
  return lookupMemoryCategory(row, rulesWithPrefix(memoryRules, "memory-correction-"));
}

export function lookupMemoryCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  memoryRules: InboxUserRule[] | null | undefined,
): InboxAiCategory | null {
  const rules = safeMemoryRecords(memoryRules);
  const domain = parseSenderDomain(row.sender ?? "");
  const subject = (row.subject ?? "").toLowerCase();

  if (domain) {
    const patternRules = rules.filter((r) => r.id.startsWith(PATTERN_RULE_PREFIX));
    for (const rule of sortRulesForPhase(patternRules, "pre")) {
      const parsed = parsePatternRuleId(rule.id);
      if (!parsed || parsed.domain !== domain) continue;
      if (!subject.includes(parsed.keyword.toLowerCase())) continue;
      if (rule.action.type === "force_category") return rule.action.category;
    }
  }

  const nonPatternRules = rules.filter((r) => !r.id.startsWith(PATTERN_RULE_PREFIX));
  const pre = applyUserRulesPre(row as GmailInboxRow, nonPatternRules);
  if (pre?.kind === "force") return pre.category;
  if (pre?.kind === "block") return "good_to_know";
  return null;
}

export function dominantActionForSender(
  snapshot: MemoryEngineSnapshot | null | undefined,
  sender: string,
): { actionId: string; sampleCount: number } | null {
  const safe = normalizeMemoryEngineSnapshot(snapshot ?? undefined);
  const identity = resolveSenderIdentity(sender);
  const matches = safe.actionMemory.filter(
    (a) =>
      (identity.email && a.senderEmail === identity.email) ||
      (identity.domain && a.senderDomain === identity.domain),
  );
  if (!matches.length) return null;
  const top = [...matches].sort((a, b) => b.sampleCount - a.sampleCount)[0]!;
  return { actionId: top.actionId, sampleCount: top.sampleCount };
}

export function memoryAuditLine(
  row: Pick<GmailInboxRow, "sender" | "subject">,
  snapshot: MemoryEngineSnapshot | null | undefined,
): string | null {
  const safe = normalizeMemoryEngineSnapshot(snapshot ?? undefined);
  const identity = resolveSenderIdentity(row.sender);
  const senderMem = safe.senderMemory.find(
    (m) =>
      (identity.email && m.senderEmail === identity.email) ||
      (identity.domain && m.senderDomain === identity.domain),
  );
  if (senderMem && meetsAutoApplyTrust(senderMem.trustScore)) {
    return `sender_memory: ${senderMem.preferredCategory} (trust ${Math.round(senderMem.trustScore * 100)}%)`;
  }

  const correction = safe.categoryCorrections.find(
    (c) =>
      (identity.email && c.senderEmail === identity.email) ||
      (identity.domain && c.senderDomain === identity.domain),
  );
  if (correction && correction.correctionCount >= MEMORY_CORRECTION_HISTORY_THRESHOLD) {
    return `correction_history: ${correction.userCategory} (${correction.correctionCount}×)`;
  }

  const keywords = extractTopicKeywords(row.subject);
  const pattern = safe.categoryPatterns.find(
    (p) =>
      identity.domain &&
      p.senderDomain === identity.domain &&
      keywords.includes(p.subjectKeyword),
  );
  if (pattern) {
    return `category_memory: ${pattern.category} via "${pattern.subjectKeyword}"`;
  }

  return null;
}
