import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  type CategorySource,
  type InboxAiCategory,
  normalizeInboxAiCategory,
} from "@/lib/inbox-ai-categories";
import {
  commercialLeanCategory,
  rulePrecClassify,
} from "@/lib/inbox-rule-classify";

export type GmailInboxRowCategorized = GmailInboxRow & {
  category: InboxAiCategory;
  categoryConfidence: number;
  categorySource: CategorySource;
};

function warnFallback(reason: string, extra?: unknown) {
  console.warn("[categorize-inbox] FALLBACK:", reason, extra ?? "");
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

/** When the model does not map a row, infer from copy (still one of the five slugs). */
export function heuristicInboxCategory(row: GmailInboxRow): InboxAiCategory {
  const lean = commercialLeanCategory(row);
  if (lean) return lean;

  const hay = `${row.subject} ${row.snippet} ${row.sender}`.toLowerCase();

  if (
    /\b(unsubscribe|email preferences|view in browser|view this email|read online|weekly digest|daily digest|mailing list)\b/i.test(
      hay,
    )
  ) {
    return "newsletter";
  }
  if (
    /\b(%\s*off|\d+%\s*off|limited time|flash sale|shop now|order now|add to cart|free shipping|promo code|black friday|cyber monday|deal ends)\b/i.test(
      hay,
    )
  ) {
    return "promotion";
  }
  if (
    /\b(order confirmed|payment received|receipt|automated message|do not reply|no[- ]reply|transaction|invoice attached|your shipment|tracking number)\b/i.test(
      hay,
    )
  ) {
    return "handled";
  }
  if (
    /\b(please confirm|could you|can you|by eod|by cob|deadline|need your approval|action required|urgent)\b/i.test(
      hay,
    )
  ) {
    return "needs_attention";
  }
  if (/\b(thanks|thank you|sounds good|confirmed|received|\+1|lgtm)\b/i.test(hay) && hay.length < 400) {
    return "quick_reply";
  }
  return "needs_attention";
}

function applyRowCategory(
  row: GmailInboxRow,
  rowIndex: number,
  category: InboxAiCategory,
  source: CategorySource,
  confidence: number,
): GmailInboxRowCategorized {
  const c = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
  console.log("EMAIL SUBJECT BEING CATEGORIZED:", row.subject);
  console.log("FINAL ASSIGNED CATEGORY:", category, {
    rowIndex,
    source,
    confidence: c,
    gmailId: row.id,
  });
  return {
    ...row,
    category,
    categoryConfidence: c,
    categorySource: source,
  };
}

/** Never let obvious bulk promo/news read as urgent work. */
function postCoerceAiCategory(
  category: InboxAiCategory,
  row: GmailInboxRow,
): { category: InboxAiCategory; source: CategorySource; confidenceMul: number } {
  if (category !== "needs_attention" && category !== "quick_reply") {
    return { category, source: "ai", confidenceMul: 1 };
  }
  const lean = commercialLeanCategory(row);
  if (!lean) {
    return { category, source: "ai", confidenceMul: 1 };
  }
  return { category: lean, source: "ai_coerced", confidenceMul: 0.92 };
}

function buildStrictAmbiguousPrompt(batchSize: number): string {
  return `You are triaging a REAL email inbox. These messages were NOT matched by deterministic rules — they are ambiguous.

Assign exactly ONE category per message (use ONLY these five strings, lowercase, underscores):
needs_attention, quick_reply, newsletter, promotion, handled

STRICT rules for realistic inboxes:
- Bulk marketing, retail offers, “act now”, “limited time”, “% off”, “shop now”, loyalty perks, or list mail MUST be "promotion" — NEVER "needs_attention".
- Editorial digests, Substacks, product updates without a hard sell, “view in browser”, “unsubscribe” footers → prefer "newsletter" over "needs_attention".
- Fake urgency in marketing (“last chance”, “expires tonight”) is still "promotion", not needs_attention.
- True needs_attention: a human expects YOU to decide, approve, reply substantively, or miss a real deadline (work, legal, calendar).
- Newsletters are NOT urgent by default — do not use needs_attention for mailing-list content.
- quick_reply: a short acknowledgment is enough (confirm receipt, yes/no, “sounds good”).
- handled: automated FYI (receipt, shipping notice, calendar hold) with nothing to decide.

Return a single JSON object only:
{"classifications":[{"index":0,"category":"needs_attention","confidence":0.78},...]}

- Exactly ${batchSize} objects, indices 0..${batchSize - 1} in order with the message blocks below.
- "confidence" is your estimated probability (0 to 1) that the label is correct.`;
}

/**
 * Parse OpenRouter response into batch-index → category + confidence.
 */
function parseAiBatchIntoMap(
  list: RawClassification[],
  batchRowCount: number,
): Map<number, { category: InboxAiCategory; confidence: number }> {
  const byIndex = new Map<number, { category: InboxAiCategory; confidence: number }>();
  const byId = new Map<string, { category: InboxAiCategory; confidence: number }>();
  const ordered = list.length === batchRowCount;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const rawCat =
      typeof item.category === "string" ? item.category.trim().toLowerCase() : "";
    const cat = normalizeInboxAiCategory(rawCat);
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
      if (!byIndex.has(i)) {
        const item = list[i];
        const rawCat =
          typeof item.category === "string" ? item.category.trim().toLowerCase() : "";
        const cat = normalizeInboxAiCategory(rawCat);
        const conf = clamp01(item.confidence) ?? 0.72;
        byIndex.set(i, { category: cat, confidence: conf });
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
    return `##${i + 1} (batch index ${i})\nid:${r.id}\nsender:${sender}\nsubject:${subject}\nsnippet:${snippet}`;
  });

  const prompt = `${buildStrictAmbiguousPrompt(rows.length)}

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
        "X-Title": "Handled Inbox Categorize (ambiguous)",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.15,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    let body: {
      choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
      error?: { message?: string };
    };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return null;
    }

    console.log("RAW AI RESPONSE (ambiguous batch):", body);

    if (!res.ok) {
      warnFallback(`ambiguous batch HTTP ${res.status}`, body.error);
      return null;
    }

    const raw = (body.choices?.[0]?.message?.content ?? "").trim();
    console.log("RAW AI RESPONSE (ambiguous content):", raw || "(empty)");
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

    console.log("PARSED JSON (ambiguous batch):", parsed);
    const list = extractClassificationsArray(parsed);
    console.log(
      "PARSED JSON (ambiguous classifications length):",
      list.length,
      "expected:",
      rows.length,
    );
    if (!list.length) return null;

    return parseAiBatchIntoMap(list, rows.length);
  } catch (e) {
    warnFallback("openAiClassifyBatch failed", e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Hybrid: rule preclassification, then OpenAI only for ambiguous rows.
 */
export async function categorizeGmailInboxRows(
  rows: GmailInboxRow[],
): Promise<GmailInboxRowCategorized[]> {
  console.log(
    "[inbox-categorize] hybrid categorize invoked, row count:",
    rows.length,
  );

  if (rows.length === 0) {
    return [];
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  const ambiguousOriginalIndices: number[] = [];
  const out: GmailInboxRowCategorized[] = new Array(
    rows.length,
  ) as GmailInboxRowCategorized[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rule = rulePrecClassify(row);
    if (rule.category) {
      console.log("[inbox-categorize] RULE PRECHECK:", row.subject, "→", rule.category, {
        confidence: rule.confidence,
        reasons: rule.scores.reasons,
      });
      out[i] = applyRowCategory(row, i, rule.category, "rule", rule.confidence);
    } else {
      ambiguousOriginalIndices.push(i);
    }
  }

  if (ambiguousOriginalIndices.length === 0) {
    return out;
  }

  const ambiguousRows = ambiguousOriginalIndices.map((i) => rows[i]);
  console.log(
    "[inbox-categorize] ambiguous count (sent to AI if key present):",
    ambiguousRows.length,
  );

  if (!apiKey) {
    warnFallback("OPENAI_API_KEY missing; heuristics for ambiguous rows only");
    for (let j = 0; j < ambiguousOriginalIndices.length; j++) {
      const i = ambiguousOriginalIndices[j];
      const row = rows[i];
      const h = heuristicInboxCategory(row);
      out[i] = applyRowCategory(row, i, h, "heuristic", 0.52);
    }
    return out;
  }

  const aiMap = await openAiClassifyBatch(ambiguousRows, apiKey);

  if (!aiMap) {
    warnFallback("AI batch failed; heuristics for ambiguous rows");
    for (let j = 0; j < ambiguousOriginalIndices.length; j++) {
      const i = ambiguousOriginalIndices[j];
      const row = rows[i];
      const h = heuristicInboxCategory(row);
      out[i] = applyRowCategory(row, i, h, "heuristic", 0.5);
    }
    return out;
  }

  for (let j = 0; j < ambiguousOriginalIndices.length; j++) {
    const i = ambiguousOriginalIndices[j];
    const row = rows[i];
    const got = aiMap.get(j);
    let category = got?.category ?? heuristicInboxCategory(row);
    let confidence = got?.confidence ?? 0.62;
    let source: CategorySource = got ? "ai" : "heuristic";

    const coerced = postCoerceAiCategory(category, row);
    if (coerced.category !== category) {
      category = coerced.category;
      source = coerced.source;
      confidence = Math.min(0.96, confidence * coerced.confidenceMul);
    }

    console.log("PARSED CATEGORY (ambiguous → final):", category, {
      batchIndex: j,
      originalIndex: i,
      source,
      confidence,
    });
    out[i] = applyRowCategory(row, i, category, source, confidence);
  }

  return out;
}
