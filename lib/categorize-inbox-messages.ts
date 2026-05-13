import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  type InboxAiCategory,
  normalizeInboxAiCategory,
} from "@/lib/inbox-ai-categories";

export type GmailInboxRowCategorized = GmailInboxRow & {
  category: InboxAiCategory;
};

function warnFallback(reason: string, extra?: unknown) {
  console.warn("[categorize-inbox] FALLBACK:", reason, extra ?? "");
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fence?.[1]?.trim() ?? t;
}

/** First top-level `{ ... }` slice when the model adds prose around JSON. */
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
};

/**
 * 0-based row index, or 1-based (model sends 1 for ##1).
 */
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

/** When the model does not map a row, infer from copy (still one of the five slugs). */
export function heuristicInboxCategory(row: GmailInboxRow): InboxAiCategory {
  const hay = `${row.subject} ${row.snippet} ${row.sender}`.toLowerCase();

  if (
    /\b(unsubscribe|email preferences|view in browser|view this email|read online|newsletter|weekly digest|daily digest|mailing list)\b/i.test(
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
  source: string,
): GmailInboxRowCategorized {
  console.log("EMAIL SUBJECT BEING CATEGORIZED:", row.subject);
  console.log("FINAL ASSIGNED CATEGORY:", category, { rowIndex, source, gmailId: row.id });
  return { ...row, category };
}

/**
 * Classifies Gmail inbox rows in one upstream call (sender, subject, snippet only).
 * Uses OpenRouter + OPENAI_API_KEY (same as `app/api/reply/route.ts`).
 */
export async function categorizeGmailInboxRows(
  rows: GmailInboxRow[],
): Promise<GmailInboxRowCategorized[]> {
  console.log(
    "[inbox-categorize] categorizeGmailInboxRows invoked, row count:",
    rows.length,
  );

  const withHeuristic = (reason: string): GmailInboxRowCategorized[] => {
    warnFallback(reason);
    return rows.map((r, i) => {
      const cat = heuristicInboxCategory(r);
      console.log("PARSED CATEGORY:", cat, "(heuristic fallback, not AI)");
      return applyRowCategory(r, i, cat, "heuristic:" + reason);
    });
  };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    warnFallback("OPENAI_API_KEY missing; using per-message heuristics");
    return withHeuristic("no_api_key");
  }
  if (rows.length === 0) {
    return [];
  }

  rows.forEach((r, i) => {
    console.log(`[inbox-categorize] input row ${i} subject:`, r.subject);
  });

  const lines = rows.map((r, i) => {
    const sender = r.sender.slice(0, 200);
    const subject = r.subject.slice(0, 400);
    const snippet = (r.snippet ?? "").slice(0, 500);
    return `##${i + 1} (index ${i})\nid:${r.id}\nsender:${sender}\nsubject:${subject}\nsnippet:${snippet}`;
  });

  const prompt = `You classify personal inbox emails for triage.

For each message below, assign exactly ONE category:
- needs_attention — needs a decision, substantive review, or non-trivial action
- quick_reply — can be handled with a short acknowledgment or a simple yes/no / confirm
- newsletter — editorial digests, blogs, recurring reads (not pure ads)
- promotion — marketing, discounts, sales, product promos
- handled — FYI, automated receipts with nothing to do, or clearly already resolved threads

Return a single JSON object (no markdown, no commentary) in this exact shape:
{"classifications":[{"index":0,"category":"needs_attention"},{"index":1,"category":"promotion"}]}

Rules:
- There are exactly ${rows.length} messages in order. You MUST output exactly ${rows.length} objects in "classifications".
- "index" is 0-based: the first block (##1) is index 0, second is index 1, etc. (You may also use 1-based indexing where index 1 means the first message; both are accepted.)
- "category" MUST be exactly one of these five strings, lowercase, with underscores as shown:
  needs_attention, quick_reply, newsletter, promotion, handled
- Do not use any other category names or punctuation.

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
        temperature: 0.2,
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
    } catch (e) {
      warnFallback("upstream response was not JSON", e);
      return withHeuristic("upstream_not_json");
    }

    console.log("RAW AI RESPONSE:", body);

    if (!res.ok) {
      warnFallback(`upstream HTTP ${res.status}`, body.error);
      console.log("RAW AI RESPONSE (error path, truncated):", JSON.stringify(body).slice(0, 8000));
      return withHeuristic(`http_${res.status}`);
    }

    const choice = body.choices?.[0]?.message;
    const raw = (choice?.content ?? "").trim();
    const refusal = (choice?.refusal ?? "").trim();

    console.log("RAW AI RESPONSE (message.content string):", raw || "(empty)");
    if (refusal) console.log("RAW AI RESPONSE (message.refusal):", refusal);

    if (!raw) {
      warnFallback("empty model content; using heuristics", { refusal: refusal || undefined });
      return withHeuristic("empty_content");
    }

    let parsed: unknown;
    const stripped = stripJsonFence(raw);
    try {
      parsed = JSON.parse(stripped);
    } catch (firstErr) {
      console.log("PARSED JSON: (first parse failed)", firstErr);
      const extracted = extractJsonObject(raw) ?? extractJsonObject(stripped);
      if (!extracted) {
        warnFallback("could not extract JSON object from model text", stripped.slice(0, 500));
        return withHeuristic("no_json_object");
      }
      try {
        parsed = JSON.parse(extracted);
      } catch (secondErr) {
        warnFallback("JSON.parse on extracted object failed", secondErr);
        console.log("PARSED JSON: (second parse failed)", secondErr);
        return withHeuristic("json_parse_failed");
      }
    }

    console.log("PARSED JSON:", parsed);

    const list = extractClassificationsArray(parsed);

    console.log(
      "PARSED JSON (classifications length):",
      list.length,
      "expected:",
      rows.length,
    );

    if (!list.length) {
      warnFallback("no classifications array in parsed JSON", parsed);
      return withHeuristic("no_classifications_array");
    }

    const byIndex = new Map<number, InboxAiCategory>();
    const byId = new Map<string, InboxAiCategory>();
    const ordered = list.length === rows.length;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const rawCat =
        typeof item.category === "string" ? item.category.trim().toLowerCase() : "";
      const extractedCategory = normalizeInboxAiCategory(rawCat);

      const subjectForLog =
        i < rows.length ? rows[i].subject : "(no matching input row index)";
      console.log("EMAIL SUBJECT BEING CATEGORIZED:", subjectForLog);
      console.log("PARSED CATEGORY:", extractedCategory, {
        listPosition: i,
        rawIndex: item.index,
        rawId: item.id,
        rawCategoryFromModel: item.category,
      });

      const idx = parseClassificationIndex(item, rows.length);
      if (idx !== null) {
        byIndex.set(idx, extractedCategory);
      }

      const idStr = normalizeGmailIdForMatch(item.id);
      if (idStr) {
        byId.set(idStr, extractedCategory);
      }
    }

    if (ordered) {
      for (let i = 0; i < rows.length; i++) {
        if (!byIndex.has(i)) {
          const item = list[i];
          const rawCat =
            typeof item.category === "string" ? item.category.trim().toLowerCase() : "";
          const extractedCategory = normalizeInboxAiCategory(rawCat);
          console.log("EMAIL SUBJECT BEING CATEGORIZED:", rows[i].subject);
          console.log("PARSED CATEGORY (positional fill):", extractedCategory, { rowIndex: i });
          byIndex.set(i, extractedCategory);
        }
      }
    }

    const rowIds = rows.map((r) => normalizeGmailIdForMatch(r.id));

    let heuristicUnmapped = 0;
    const out: GmailInboxRowCategorized[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      if (byIndex.has(i)) {
        const category = byIndex.get(i)!;
        out.push(applyRowCategory(r, i, category, "model_index"));
        continue;
      }

      const idNorm = normalizeGmailIdForMatch(r.id);
      let category: InboxAiCategory | undefined = byId.get(idNorm);

      if (!category) {
        for (const [k, v] of byId) {
          if (!k) continue;
          if (k.length >= 8 && (idNorm.startsWith(k) || k.startsWith(idNorm))) {
            category = v;
            break;
          }
        }
      }

      if (!category && rowIds[i]) {
        for (const [k, v] of byId) {
          if (k && rowIds[i].endsWith(k)) {
            category = v;
            break;
          }
        }
      }

      if (category) {
        out.push(applyRowCategory(r, i, category, "model_id"));
        continue;
      }

      heuristicUnmapped++;
      const h = heuristicInboxCategory(r);
      console.log("PARSED CATEGORY:", h, "(heuristic, no model mapping)");
      out.push(applyRowCategory(r, i, h, "heuristic_unmapped"));
    }

    if (heuristicUnmapped > 0) {
      warnFallback(
        `${heuristicUnmapped} / ${rows.length} rows had no model index/id match; heuristics used for those`,
      );
    }

    return out;
  } catch (e) {
    warnFallback("unexpected error during categorization", e);
    return withHeuristic("exception");
  } finally {
    clearTimeout(timeoutId);
  }
}
