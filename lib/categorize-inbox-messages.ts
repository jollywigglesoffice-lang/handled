import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  type CategorySource,
  type InboxAiCategory,
  parseInboxAiCategory,
} from "@/lib/inbox-ai-categories";
import {
  coerceNeedsAttentionCategory,
  commercialLeanCategory,
  computeInboxRuleScores,
  hardPostAiCategory,
  looksLikeHumanConversation,
  ruleClassify,
} from "@/lib/inbox-rule-classify";
import { getAiApiKey, logAiKeyStatus } from "@/lib/ai-api-key";
import { isCommercialBulk } from "@/lib/inbox-triage-signals";
import {
  applyUserRulesPost,
  applyUserRulesPre,
  type InboxUserRule,
} from "@/lib/inbox-user-rules";
import {
  analyzeCategorizationIntelligence,
  mustNotAutoHandle,
  type CategorizationIntelligenceResult,
} from "@/lib/categorization-intelligence";
import {
  analyzeEmailIntent,
  hasHighPriorityIntent,
  safetyCategoryWhenUncertain,
} from "@/lib/email-intent";
import { applyRelationshipToCategory } from "@/lib/relationship-intelligence/effects";
import { resolveRelationshipCategory } from "@/lib/relationship-intelligence/relationship-category";
import { resolveSenderRelationship } from "@/lib/relationship-intelligence/resolve";
import type { SenderRelationship, SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import { isUserLockedCategorySource } from "@/lib/category-authority";
import { stampEmailOverridesOnMessages } from "@/lib/email-overrides/apply-to-messages";
import {
  logCategoryResolution,
  mustSkipAiCategorization,
  resolveFinalCategory,
  type CategoryResolutionContext,
} from "@/lib/final-category-resolution";
import { applyWorkflowModeToCategory } from "@/lib/workflow-mode-effects";
import type { WorkflowMode } from "@/lib/workflow-mode";

function mustNotAutoHandleRow(row: GmailInboxRow): boolean {
  return mustNotAutoHandle(row);
}

function senderRulesForIntelligence(rules: InboxUserRule[]) {
  return rules
    .filter((r) => r.action.type === "force_category")
    .map((r) => {
      if (r.action.type !== "force_category") return null;
      const match = r.match;
      if (match.type === "sender_email") {
        return { senderEmail: match.value, targetCategory: r.action.category };
      }
      if (match.type === "sender_domain") {
        return { senderDomain: match.value, targetCategory: r.action.category };
      }
      if (match.type === "sender_contains") {
        return { senderEmail: match.value, targetCategory: r.action.category };
      }
      return null;
    })
    .filter(Boolean) as Array<{
    senderEmail?: string;
    senderDomain?: string;
    targetCategory: InboxAiCategory;
  }>;
}

function runIntelligence(
  row: GmailInboxRow,
  senderRules: InboxUserRule[],
  relationship?: SenderRelationshipProfile | null,
): CategorizationIntelligenceResult {
  return analyzeCategorizationIntelligence(row, {
    senderRules: senderRulesForIntelligence(senderRules),
    relationshipKind: relationship?.kind ?? null,
    relationshipImportance: relationship?.importance ?? null,
  });
}

export type GmailInboxRowCategorized = GmailInboxRow & {
  category: InboxAiCategory;
  categoryConfidence: number;
  categorySource: CategorySource;
  /** Internal explainability — not rendered in UI yet */
  categoryReasons?: string[];
  categoryReasonLabels?: string[];
  relationship?: SenderRelationshipProfile;
};

function warnFallback(reason: string, extra?: unknown) {
  console.warn("[categorize-inbox] FALLBACK:", reason, extra ?? "");
}

/**
 * Per-row categorization logs are very chatty (a few lines × up to 200 rows).
 * They're useful when debugging classification but pure overhead otherwise, so
 * they're opt-in via CATEGORIZE_DEBUG=1 rather than tied to NODE_ENV.
 */
const CATEGORIZE_DEBUG = process.env.CATEGORIZE_DEBUG === "1";

function debugCategorize(...args: unknown[]): void {
  if (CATEGORIZE_DEBUG) console.log(...args);
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fence?.[1]?.trim() ?? t;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function openRouterReferer(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv?.startsWith("http")) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

type RawClassification = {
  index?: number | string;
  id?: string | number;
  category?: string;
  confidence?: number | string;
};

function parseClassificationIndex(
  item: RawClassification,
  rowCount: number,
): number | null {
  if (item.index === undefined || item.index === null) return null;

  let n: number;
  if (typeof item.index === "number" && Number.isFinite(item.index)) {
    n = Math.trunc(item.index);
  } else if (typeof item.index === "string") {
    n = parseInt(item.index.trim(), 10);
    if (!Number.isFinite(n)) return null;
  } else {
    return null;
  }

  if (n >= 0 && n < rowCount) return n;
  if (n >= 1 && n <= rowCount) return n - 1;
  return null;
}

function normalizeGmailIdForMatch(id: unknown): string {
  return String(id ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function extractClassificationsArray(parsed: unknown): RawClassification[] {
  if (typeof parsed === "string") {
    try {
      const inner = JSON.parse(parsed) as unknown;
      return extractClassificationsArray(inner);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) return parsed as RawClassification[];
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    for (const key of ["classifications", "items", "results", "categories"]) {
      const c = o[key];
      if (Array.isArray(c)) return c as RawClassification[];
    }
  }
  return [];
}

function clamp01(n: unknown): number | undefined {
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.max(0, Math.min(1, n));
  }
  if (typeof n === "string") {
    const x = parseFloat(n.trim());
    if (Number.isFinite(x)) return Math.max(0, Math.min(1, x));
  }
  return undefined;
}

/**
 * Last-resort deterministic triage — needs_attention ONLY when human conversation is likely.
 * Never returns needs_attention as a blind default.
 */
export function intelligentFallbackCategory(row: GmailInboxRow): {
  category: InboxAiCategory;
  confidence: number;
} {
  const intent = analyzeEmailIntent(row);
  if (intent.highPriority) {
    return {
      category: intent.suggestedCategory,
      confidence: Math.max(0.82, intent.confidence),
    };
  }

  const hard = hardPostAiCategory(row);
  if (hard) {
    return { category: hard, confidence: 0.72 };
  }

  const lean = commercialLeanCategory(row);
  if (lean) {
    return { category: lean, confidence: 0.68 };
  }

  const hay = `${row.subject} ${row.snippet ?? ""} ${row.sender}`.toLowerCase();

  if (
    /unsubscribe|email preferences|view in browser|view this email|read online|weekly digest|daily digest|mailing list|manage preferences/i.test(
      hay,
    )
  ) {
    return { category: "newsletter", confidence: 0.65 };
  }
  if (
    /%\s*off|\d+%\s*off|limited time|flash sale|shop now|order now|add to cart|free shipping|promo code|black friday|sponsored|act now/i.test(
      hay,
    )
  ) {
    return { category: "promotion", confidence: 0.65 };
  }
  if (
    /order confirmed|payment received|receipt|tracking number|your shipment|has shipped|invoice|charged|subscription renewed|amount due/i.test(
      hay,
    ) &&
    !mustNotAutoHandleRow(row)
  ) {
    return { category: "fyi", confidence: 0.7 };
  }
  if (
    /\b(thanks|thank you|sounds good|confirmed|received|\+1|lgtm)\b/i.test(hay) &&
    hay.length < 400
  ) {
    return { category: "quick_reply", confidence: 0.6 };
  }

  const scores = computeInboxRuleScores(row);
  const max = Math.max(scores.promotion, scores.newsletter, scores.handled);
  if (max > 0) {
    if (scores.handled >= max) return { category: "handled", confidence: 0.55 };
    if (scores.promotion >= max) return { category: "promotion", confidence: 0.55 };
    if (scores.newsletter >= max) return { category: "newsletter", confidence: 0.55 };
  }

  if (looksLikeHumanConversation(row)) {
    if (
      /\b(thanks|thank you|sounds good|got it|confirmed)\b/i.test(hay) &&
      hay.length < 500
    ) {
      return { category: "quick_reply", confidence: 0.58 };
    }
    return { category: "needs_attention", confidence: 0.55 };
  }

  if (isCommercialBulk(row)) {
    return { category: "promotion", confidence: 0.5 };
  }

  return { category: "needs_attention", confidence: 0.48 };
}

function finalizeRow(
  row: GmailInboxRow,
  rowIndex: number,
  category: InboxAiCategory,
  source: CategorySource,
  confidence: number,
  relationship?: SenderRelationshipProfile | null,
  intelligence?: CategorizationIntelligenceResult,
): GmailInboxRowCategorized {
  if (isUserLockedCategorySource(source)) {
    return {
      ...row,
      category,
      categoryConfidence: 1,
      categorySource: source,
      relationship: relationship ?? undefined,
    };
  }

  const c = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
  let coerced = coerceNeedsAttentionCategory(row, category);
  coerced = safetyCategoryWhenUncertain(row, coerced, c, relationship);

  if (intelligence?.forcePromotional) {
    coerced = intelligence.suggestedCategory;
  }

  if (intelligence?.blockLowPriorityCategories && !intelligence.forcePromotional && (coerced === "handled" || coerced === "fyi" || coerced === "promotion" || coerced === "newsletter")) {
    coerced = intelligence.suggestedCategory;
  }

  if (intelligence?.forceNeedsAttention && !intelligence?.forcePromotional && (coerced === "handled" || coerced === "fyi" || coerced === "promotion" || coerced === "newsletter")) {
    coerced = "needs_attention";
  }

  if (relationship) {
    coerced = applyRelationshipToCategory(row, coerced, relationship);
  }

  const reasons = intelligence?.reasonCodes ?? [];
  const reasonLabels = intelligence?.reasonLabels ?? [];

  if (reasons.length) {
    debugCategorize("CATEGORIZATION INTELLIGENCE:", {
      subject: row.subject?.slice(0, 100),
      reasons: reasonLabels,
      priorityScore: intelligence?.priorityScore,
      suggested: intelligence?.suggestedCategory,
      final: coerced,
    });
  }

  debugCategorize("FINAL CATEGORY:", coerced, {
    subject: row.subject?.slice(0, 100),
    rowIndex,
    source,
    confidence: c,
    gmailId: row.id,
    relationship: relationship?.kind,
  });

  let finalConfidence = coerced !== category ? Math.max(c, 0.75) : c;
  if (intelligence?.forceNeedsAttention && coerced === "needs_attention") {
    finalConfidence = Math.max(finalConfidence, intelligence.confidence);
  }
  if (intelligence && (reasonLabels.includes("Mixed personal and marketing signals") || reasons.includes("ambiguous_unknown_sender"))) {
    finalConfidence = Math.min(finalConfidence, 0.68);
  }

  return {
    ...row,
    category: coerced,
    categoryConfidence: finalConfidence,
    categorySource: coerced !== category ? "intelligence_rule" : source,
    categoryReasons: reasons.length ? reasons : undefined,
    categoryReasonLabels: reasonLabels.length ? reasonLabels : undefined,
    relationship: relationship ?? undefined,
  };
}

/** Correct AI labels that wrongly mark bulk/billing as urgent. */
function correctUrgentAiLabel(
  category: InboxAiCategory,
  row: GmailInboxRow,
): { category: InboxAiCategory; source: CategorySource; confidenceMul: number } {
  if (hasHighPriorityIntent(row)) {
    const intent = analyzeEmailIntent(row);
    if (
      category === "handled" ||
      category === "fyi" ||
      category === "promotion" ||
      category === "newsletter"
    ) {
      return {
        category: intent.suggestedCategory,
        source: "ai_coerced",
        confidenceMul: 0.95,
      };
    }
    return { category, source: "ai", confidenceMul: 1 };
  }

  if (category !== "needs_attention" && category !== "quick_reply") {
    return { category, source: "ai", confidenceMul: 1 };
  }

  const hard = hardPostAiCategory(row);
  if (hard) {
    return { category: hard, source: "ai_coerced", confidenceMul: 0.9 };
  }

  const lean = commercialLeanCategory(row);
  if (lean) {
    return { category: lean, source: "ai_coerced", confidenceMul: 0.92 };
  }

  if (category === "needs_attention" && !looksLikeHumanConversation(row)) {
    const fb = intelligentFallbackCategory(row);
    if ((fb.category === "handled" || fb.category === "fyi") && hasHighPriorityIntent(row)) {
      return {
        category: analyzeEmailIntent(row).suggestedCategory,
        source: "ai_coerced",
        confidenceMul: 0.9,
      };
    }
    return { category: fb.category, source: "ai_coerced", confidenceMul: 0.85 };
  }

  return { category, source: "ai", confidenceMul: 1 };
}

function buildAmbiguousAiPrompt(batchSize: number): string {
  return `You triage a real personal + work inbox. Messages may be in English, Italian, or mixed (EN/IT). These did NOT match deterministic rules.

Use ONLY: needs_attention, quick_reply, fyi, newsletter, promotion, handled

CULTURAL / PERSONAL PRIORITY (overrides business-startup bias):
- School / teachers / parents (scuola, insegnante, colloquio, maestra, genitori, PTA, Alexandria-style school names) → needs_attention
- Family, kids, childcare → needs_attention
- Healthcare (ospedale, pediatra, appuntamento medico, hospital, pediatric) → needs_attention
- Scheduling that needs a human decision (riunione, appuntamento, conferma, meeting) → needs_attention or quick_reply if only a short ack is needed
- Payments/confirmations about school, health, or family → needs_attention (not fyi)

COMMERCIAL (only when clearly bulk/marketing):
- promotion — marketing, sales, discounts, social app notifications
- newsletter — digests, list mail, unsubscribe footers

FYI (important to see, but no reply needed):
- fyi — automated transactional confirmations the user would want to notice: order/shipping/delivery confirmations (es. "conferma spedizione", "il tuo ordine è stato spedito"), payment receipts, invoices, booking/appointment confirmations, account/security alerts. NO personal/school/health context and NO reply expected.

LOW-RISK DEFAULT:
- handled — already-quiet, low-information automated noise that needs no notice
- quick_reply — short acknowledgment suffices

SAFETY: When unsure between fyi/handled and needs_attention for a plausible human/school/health sender, choose needs_attention. Missing important family or school mail is worse than a false positive.

NEVER use fyi or handled for: school mail, teacher/parent messages, Italian urgency words (urgente, colloquio), or a named person writing about appointments.

Return JSON only:
{"classifications":[{"index":0,"category":"needs_attention","confidence":0.85},...]}

Exactly ${batchSize} items, indices 0..${batchSize - 1}.`;
}

function parseAiBatchIntoMap(
  list: RawClassification[],
  batchRowCount: number,
): Map<number, { category: InboxAiCategory; confidence: number }> {
  const byIndex = new Map<number, { category: InboxAiCategory; confidence: number }>();
  const byId = new Map<string, { category: InboxAiCategory; confidence: number }>();
  const ordered = list.length === batchRowCount;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const rawCat = typeof item.category === "string" ? item.category : "";
    const cat = parseInboxAiCategory(rawCat);
    if (!cat) continue;
    const conf = clamp01(item.confidence) ?? 0.72;

    const idx = parseClassificationIndex(item, batchRowCount);
    if (idx !== null) {
      byIndex.set(idx, { category: cat, confidence: conf });
    }
    const idStr = normalizeGmailIdForMatch(item.id);
    if (idStr) {
      byId.set(idStr, { category: cat, confidence: conf });
    }
  }

  if (ordered) {
    for (let i = 0; i < batchRowCount; i++) {
      if (!byIndex.has(i) && list[i]) {
        const rawCat = typeof list[i].category === "string" ? list[i].category! : "";
        const cat = parseInboxAiCategory(rawCat);
        if (cat) {
          const conf = clamp01(list[i].confidence) ?? 0.72;
          byIndex.set(i, { category: cat, confidence: conf });
        }
      }
    }
  }

  const out = new Map<number, { category: InboxAiCategory; confidence: number }>();
  for (let i = 0; i < batchRowCount; i++) {
    if (byIndex.has(i)) {
      out.set(i, byIndex.get(i)!);
      continue;
    }
    const idNorm = normalizeGmailIdForMatch(list[i]?.id);
    let hit = idNorm ? byId.get(idNorm) : undefined;
    if (!hit) {
      for (const [k, v] of byId) {
        if (k.length >= 8 && idNorm && (idNorm.startsWith(k) || k.startsWith(idNorm))) {
          hit = v;
          break;
        }
      }
    }
    if (hit) out.set(i, hit);
  }
  return out;
}

async function openAiClassifyBatch(
  rows: GmailInboxRow[],
  apiKey: string,
): Promise<Map<number, { category: InboxAiCategory; confidence: number }> | null> {
  if (rows.length === 0) {
    return new Map();
  }

  const lines = rows.map((r, i) => {
    const sender = r.sender.slice(0, 200);
    const subject = r.subject.slice(0, 400);
    const snippet = (r.snippet ?? "").slice(0, 500);
    return `##${i + 1} (index ${i})\nid:${r.id}\nsender:${sender}\nsubject:${subject}\nsnippet:${snippet}`;
  });

  const prompt = `${buildAmbiguousAiPrompt(rows.length)}

Messages:
${lines.join("\n\n")}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 22_000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": openRouterReferer(),
        "X-Title": "Handled Inbox Categorize",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.15,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    let body: {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return null;
    }

    if (!res.ok) {
      warnFallback(`AI HTTP ${res.status}`, body.error);
      return null;
    }

    const raw = (body.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) return null;

    let parsed: unknown;
    const stripped = stripJsonFence(raw);
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const extracted = extractJsonObject(raw) ?? extractJsonObject(stripped);
      if (!extracted) return null;
      try {
        parsed = JSON.parse(extracted);
      } catch {
        return null;
      }
    }

    const list = extractClassificationsArray(parsed);
    if (!list.length) return null;

    return parseAiBatchIntoMap(list, rows.length);
  } catch (e) {
    warnFallback("openAiClassifyBatch exception", e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Classify ambiguous rows in parallel chunks instead of one giant request.
 * A single 200-message prompt to the model is slow (and risks truncation /
 * timeout); several smaller prompts in parallel return far faster. Each row is
 * classified independently, so chunking is behavior-equivalent. Returns a map
 * keyed by the GLOBAL ambiguous index (0..rows.length-1).
 */
const AI_CLASSIFY_CHUNK_SIZE = 40;

async function openAiClassifyChunked(
  rows: GmailInboxRow[],
  apiKey: string,
): Promise<Map<number, { category: InboxAiCategory; confidence: number }>> {
  if (rows.length <= AI_CLASSIFY_CHUNK_SIZE) {
    return (await openAiClassifyBatch(rows, apiKey)) ?? new Map();
  }

  const chunks: Array<{ start: number; rows: GmailInboxRow[] }> = [];
  for (let i = 0; i < rows.length; i += AI_CLASSIFY_CHUNK_SIZE) {
    chunks.push({ start: i, rows: rows.slice(i, i + AI_CLASSIFY_CHUNK_SIZE) });
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      openAiClassifyBatch(chunk.rows, apiKey).then((map) => ({ start: chunk.start, map })),
    ),
  );

  const merged = new Map<number, { category: InboxAiCategory; confidence: number }>();
  for (const { start, map } of results) {
    if (!map) continue;
    for (const [localIndex, value] of map) {
      merged.set(start + localIndex, value);
    }
  }
  return merged;
}

export type CategorizeInboxOptions = {
  userRules?: InboxUserRule[];
  /** Learned sender rules — evaluated before keyword userRules. */
  senderRules?: InboxUserRule[];
  /** Per-email manual overrides — highest priority, skips AI and rules. */
  emailOverrides?: Record<string, InboxAiCategory>;
  senderRelationships?: SenderRelationship[];
  workflowMode?: WorkflowMode;
};

function applyUserPostIfNeeded(
  row: GmailInboxRow,
  rowIndex: number,
  category: InboxAiCategory,
  source: CategorySource,
  confidence: number,
  userRules: InboxUserRule[],
  workflowMode: WorkflowMode,
  senderRelationships: SenderRelationship[],
  intelligence?: CategorizationIntelligenceResult,
): GmailInboxRowCategorized {
  const post = applyUserRulesPost(row, category, userRules);
  const afterUser = post
    ? { category: post.category, source: "user_rule" as const, confidence: 0.94 }
    : { category, source, confidence };

  const relationship = resolveSenderRelationship(row, afterUser.category, senderRelationships);

  const modeAdjusted = applyWorkflowModeToCategory(
    workflowMode,
    row,
    afterUser.category,
    afterUser.source,
  );

  const intel =
    intelligence ??
    runIntelligence(row, userRules, relationship);

  return finalizeRow(
    row,
    rowIndex,
    modeAdjusted.category,
    modeAdjusted.source,
    afterUser.confidence,
    relationship,
    intel,
  );
}

/**
 * Pipeline: manual overrides → relationship/semantic memory → sender rules → keyword rules
 * → multilingual importance → system rules → AI → fallback → post-rules.
 */
export async function categorizeGmailInboxRows(
  rows: GmailInboxRow[],
  options?: CategorizeInboxOptions,
): Promise<GmailInboxRowCategorized[]> {
  if (rows.length === 0) {
    return [];
  }

  const senderRules = options?.senderRules ?? [];
  const userRules = options?.userRules ?? [];
  const emailOverrides = options?.emailOverrides ?? {};
  const senderRelationships = options?.senderRelationships ?? [];
  const allUserRules = [...senderRules, ...userRules];
  const workflowMode = options?.workflowMode ?? "assist";
  const apiKey = getAiApiKey();
  logAiKeyStatus("categorize-inbox");
  const resolutionCtx: CategoryResolutionContext = { emailOverrides, senderRules };
  const ambiguousIndices: number[] = [];
  const out: GmailInboxRowCategorized[] = new Array(rows.length) as GmailInboxRowCategorized[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (mustSkipAiCategorization(row, resolutionCtx)) {
      const resolved = resolveFinalCategory({
        row,
        context: resolutionCtx,
      });
      logCategoryResolution(resolved.audit);
      const rel = resolveSenderRelationship(row, resolved.category, senderRelationships);
      out[i] = finalizeRow(row, i, resolved.category, resolved.source, 1, rel);
      continue;
    }

    const relationshipForced = resolveRelationshipCategory(row, senderRelationships);
    if (relationshipForced) {
      const relSource: CategorySource =
        relationshipForced.source === "semantic_memory" ? "semantic_rule" : "relationship_rule";
      out[i] = applyUserPostIfNeeded(
        row,
        i,
        relationshipForced.category,
        relSource,
        0.94,
        allUserRules,
        workflowMode,
        senderRelationships,
      );
      continue;
    }

    const keywordPre = applyUserRulesPre(row, userRules);
    const userPre = keywordPre;
    const preSource: CategorySource = "user_rule";

    if (userPre?.kind === "force") {
      debugCategorize("RULE MATCH:", userPre.category, {
        source: "user_pre",
        label: userPre.label,
      });
      out[i] = applyUserPostIfNeeded(
        row,
        i,
        userPre.category,
        preSource,
        0.96,
        allUserRules,
        workflowMode,
        senderRelationships,
      );
      continue;
    }
    if (userPre?.kind === "block") {
      debugCategorize("RULE MATCH: block", { label: userPre.label });
      out[i] = applyUserPostIfNeeded(
        row,
        i,
        "handled",
        preSource,
        0.99,
        allUserRules,
        workflowMode,
        senderRelationships,
      );
      continue;
    }

    const importance = runIntelligence(row, senderRules);

    if (importance.forcePromotional) {
      out[i] = applyUserPostIfNeeded(
        row,
        i,
        importance.suggestedCategory,
        "intelligence_rule",
        importance.confidence,
        allUserRules,
        workflowMode,
        senderRelationships,
        importance,
      );
      continue;
    }

    if (importance.forceNeedsAttention || importance.blockLowPriorityCategories) {
      out[i] = applyUserPostIfNeeded(
        row,
        i,
        importance.suggestedCategory,
        "intelligence_rule",
        importance.confidence,
        allUserRules,
        workflowMode,
        senderRelationships,
        importance,
      );
      continue;
    }

    const rule = ruleClassify(row);

    if (rule) {
      debugCategorize("RULE MATCH:", rule.category, {
        subject: row.subject?.slice(0, 100),
        matchType: rule.matchType,
        confidence: rule.confidence,
        reasons: rule.scores.reasons,
        scores: {
          promotion: rule.scores.promotion,
          newsletter: rule.scores.newsletter,
          handled: rule.scores.handled,
        },
      });
      out[i] = applyUserPostIfNeeded(
        row,
        i,
        rule.category,
        "rule",
        rule.confidence,
        allUserRules,
        workflowMode,
        senderRelationships,
      );
    } else {
      if (mustSkipAiCategorization(row, resolutionCtx)) {
        const resolved = resolveFinalCategory({ row, context: resolutionCtx });
        logCategoryResolution(resolved.audit);
        out[i] = finalizeRow(row, i, resolved.category, resolved.source, 1);
      } else {
        ambiguousIndices.push(i);
      }
    }
  }

  if (ambiguousIndices.length === 0) {
    return applyFinalResolutionPass(out, rows, resolutionCtx);
  }

  const ambiguousRows = ambiguousIndices.map((i) => rows[i]);

  const classifyAmbiguousRow = (
    row: GmailInboxRow,
    rowIndex: number,
    aiResult: { category: InboxAiCategory; confidence: number } | undefined,
  ): GmailInboxRowCategorized => {
    if (aiResult) {
      debugCategorize("AI CATEGORY:", aiResult.category, {
        subject: row.subject?.slice(0, 100),
        confidence: aiResult.confidence,
        rowIndex,
      });

      let category = aiResult.category;
      let confidence = aiResult.confidence;
      let source: CategorySource = "ai";

      const corrected = correctUrgentAiLabel(category, row);
      if (corrected.category !== category) {
        category = corrected.category;
        source = corrected.source;
        confidence = Math.min(0.96, confidence * corrected.confidenceMul);
      }

      return applyUserPostIfNeeded(
        row,
        rowIndex,
        category,
        source,
        confidence,
        allUserRules,
        workflowMode,
        senderRelationships,
      );
    }

    const fb = intelligentFallbackCategory(row);
    debugCategorize("AI CATEGORY:", "(none — intelligent fallback)", {
      subject: row.subject?.slice(0, 100),
      fallback: fb.category,
    });
    return applyUserPostIfNeeded(
      row,
      rowIndex,
      fb.category,
      "heuristic",
      fb.confidence,
      allUserRules,
      workflowMode,
      senderRelationships,
    );
  };

  if (!apiKey) {
    warnFallback("OPENAI_API_KEY missing");
    for (let j = 0; j < ambiguousIndices.length; j++) {
      const i = ambiguousIndices[j];
      out[i] = classifyAmbiguousRow(rows[i], i, undefined);
    }
    return applyFinalResolutionPass(out, rows, resolutionCtx);
  }

  const aiMap = await openAiClassifyChunked(ambiguousRows, apiKey);

  if (aiMap.size === 0) {
    warnFallback("AI batch failed");
  }

  for (let j = 0; j < ambiguousIndices.length; j++) {
    const i = ambiguousIndices[j];
    if (mustSkipAiCategorization(rows[i], resolutionCtx)) {
      const resolved = resolveFinalCategory({ row: rows[i], context: resolutionCtx });
      logCategoryResolution(resolved.audit);
      out[i] = finalizeRow(rows[i], i, resolved.category, resolved.source, 1);
      continue;
    }
    const got = aiMap.get(j);
    out[i] = classifyAmbiguousRow(rows[i], i, got);
  }

  return applyFinalResolutionPass(out, rows, resolutionCtx);
}

/** Last gate: user overrides and sender rules always win over any pipeline/AI output. */
function applyFinalResolutionPass(
  out: GmailInboxRowCategorized[],
  rows: GmailInboxRow[],
  context: CategoryResolutionContext,
): GmailInboxRowCategorized[] {
  const resolved = out.map((categorized, index) => {
    const row = rows[index];
    const pipelineSource = categorized.categorySource;
    const isAiLike =
      pipelineSource === "ai" ||
      pipelineSource === "heuristic" ||
      pipelineSource === "ai_coerced" ||
      pipelineSource === "rule" ||
      pipelineSource === "intelligence_rule";

    const result = resolveFinalCategory({
      row,
      pipelineCategory: categorized.category,
      pipelineSource,
      aiCategory: isAiLike ? categorized.category : null,
      aiSource: pipelineSource,
      context,
    });

    logCategoryResolution(result.audit);

    if (result.source !== categorized.categorySource || result.category !== categorized.category) {
      return {
        ...categorized,
        category: result.category,
        categorySource: result.source,
        categoryConfidence:
          result.source === "manual_override" || result.source === "sender_rule"
            ? 1
            : categorized.categoryConfidence,
      };
    }
    return categorized;
  });

  return stampEmailOverridesOnMessages(resolved, context.emailOverrides);
}

/** @deprecated Use intelligentFallbackCategory */
export function heuristicInboxCategory(row: GmailInboxRow): InboxAiCategory {
  return intelligentFallbackCategory(row).category;
}
