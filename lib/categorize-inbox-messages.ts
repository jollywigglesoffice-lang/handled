import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  type InboxAiCategory,
  normalizeInboxAiCategory,
} from "@/lib/inbox-ai-categories";

export type GmailInboxRowCategorized = GmailInboxRow & {
  category: InboxAiCategory;
};

const DEBUG =
  typeof process !== "undefined" && process.env.DEBUG_INBOX_CATEGORIZE === "1";

function debugLog(...args: unknown[]) {
  if (DEBUG) console.log("[categorize-inbox]", ...args);
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

function parseClassificationIndex(
  item: RawClassification,
  rowCount: number,
): number | null {
  if (typeof item.index === "number" && Number.isInteger(item.index)) {
    if (item.index >= 0 && item.index < rowCount) return item.index;
    return null;
  }
  if (typeof item.index === "string") {
    const n = parseInt(item.index.trim(), 10);
    if (Number.isFinite(n) && n >= 0 && n < rowCount) return n;
  }
  return null;
}

function normalizeGmailIdForMatch(id: unknown): string {
  return String(id ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function extractClassificationsArray(parsed: unknown): RawClassification[] {
  if (Array.isArray(parsed)) return parsed as RawClassification[];
  if (parsed && typeof parsed === "object") {
    const c = (parsed as { classifications?: unknown }).classifications;
    if (Array.isArray(c)) return c as RawClassification[];
  }
  return [];
}

/**
 * Classifies Gmail inbox rows in one upstream call (sender, subject, snippet only).
 * Uses the same OpenRouter + OPENAI_API_KEY setup as `app/api/reply/route.ts`.
 *
 * Mapping uses **0-based `index` first** (aligned with message order) because models
 * often mangle long Gmail `id` strings; `id` is used as a secondary match when present.
 */
export async function categorizeGmailInboxRows(
  rows: GmailInboxRow[],
): Promise<GmailInboxRowCategorized[]> {
  const defaultAll = (cat: InboxAiCategory): GmailInboxRowCategorized[] =>
    rows.map((r) => ({ ...r, category: cat }));

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || rows.length === 0) {
    debugLog("skip: no API key or empty rows → all needs_attention");
    return defaultAll("needs_attention");
  }

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
- There are exactly ${rows.length} messages in order. You MUST output exactly ${rows.length} objects in classifications.
- "index" is 0-based: the first block (##1) is index 0, second is index 1, etc.
- "category" must be one of these strings only: needs_attention, quick_reply, newsletter, promotion, handled

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
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    let body: {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      console.error("[categorize-inbox] invalid JSON from upstream");
      return defaultAll("needs_attention");
    }

    if (!res.ok) {
      console.error("[categorize-inbox] upstream error", res.status, body.error);
      debugLog("raw upstream body (error)", JSON.stringify(body).slice(0, 2000));
      return defaultAll("needs_attention");
    }

    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      console.error("[categorize-inbox] empty model content");
      return defaultAll("needs_attention");
    }

    debugLog("raw OpenAI/OpenRouter message.content (trunc)", raw.slice(0, 2500));

    let parsed: unknown;
    const stripped = stripJsonFence(raw);
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const extracted = extractJsonObject(raw) ?? extractJsonObject(stripped);
      if (!extracted) {
        console.error("[categorize-inbox] JSON parse failed, no object extracted");
        debugLog("stripJsonFence result (trunc)", stripped.slice(0, 1500));
        return defaultAll("needs_attention");
      }
      try {
        parsed = JSON.parse(extracted);
      } catch {
        console.error("[categorize-inbox] JSON parse failed on extracted object");
        debugLog("extracted (trunc)", extracted.slice(0, 1500));
        return defaultAll("needs_attention");
      }
    }

    const list = extractClassificationsArray(parsed);
    if (!list.length) {
      console.error("[categorize-inbox] missing classifications array", {
        keys: parsed && typeof parsed === "object" ? Object.keys(parsed as object) : [],
      });
      return defaultAll("needs_attention");
    }

    const byIndex = new Map<number, InboxAiCategory>();
    const byId = new Map<string, InboxAiCategory>();

    for (const item of list) {
      const rawCat = typeof item.category === "string" ? item.category : "";
      const parsedCat = normalizeInboxAiCategory(rawCat || "needs_attention");
      debugLog("parsed item", { index: item.index, id: item.id, rawCategory: rawCat, normalized: parsedCat });

      const idx = parseClassificationIndex(item, rows.length);
      if (idx !== null) {
        byIndex.set(idx, parsedCat);
      }

      const idStr = normalizeGmailIdForMatch(item.id);
      if (idStr) {
        byId.set(idStr, parsedCat);
      }
    }

    const rowIds = rows.map((r) => normalizeGmailIdForMatch(r.id));

    return rows.map((r, i) => {
      if (byIndex.has(i)) {
        const category = byIndex.get(i)!;
        debugLog("final row", { rowIndex: i, gmailId: r.id, assigned: category, source: "index" });
        return { ...r, category };
      }

      const idNorm = normalizeGmailIdForMatch(r.id);
      let category: InboxAiCategory = byId.get(idNorm) ?? "needs_attention";

      if (category === "needs_attention") {
        for (const [k, v] of byId) {
          if (!k) continue;
          if (k.length >= 8 && (idNorm.startsWith(k) || k.startsWith(idNorm))) {
            category = v;
            break;
          }
        }
      }

      if (category === "needs_attention" && rowIds[i]) {
        for (const [k, v] of byId) {
          if (k && rowIds[i].endsWith(k)) {
            category = v;
            break;
          }
        }
      }

      debugLog("final row", {
        rowIndex: i,
        gmailId: r.id,
        assigned: category,
        source: "id-fallback",
      });
      return { ...r, category };
    });
  } catch (e) {
    console.error("[categorize-inbox]", e);
    return defaultAll("needs_attention");
  } finally {
    clearTimeout(timeoutId);
  }
}
