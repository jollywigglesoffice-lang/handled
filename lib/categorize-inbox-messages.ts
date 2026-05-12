import type { GmailInboxRow } from "@/lib/gmail-api";
import {
  type InboxAiCategory,
  normalizeInboxAiCategory,
} from "@/lib/inbox-ai-categories";

export type GmailInboxRowCategorized = GmailInboxRow & {
  category: InboxAiCategory;
};

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fence?.[1]?.trim() ?? t;
}

function openRouterReferer(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv?.startsWith("http")) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Classifies Gmail inbox rows in one upstream call (sender, subject, snippet only).
 * Uses the same OpenRouter + OPENAI_API_KEY setup as `app/api/reply/route.ts`.
 */
export async function categorizeGmailInboxRows(
  rows: GmailInboxRow[],
): Promise<GmailInboxRowCategorized[]> {
  const defaultAll = (cat: InboxAiCategory): GmailInboxRowCategorized[] =>
    rows.map((r) => ({ ...r, category: cat }));

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || rows.length === 0) {
    return defaultAll("needs_attention");
  }

  const lines = rows.map((r, i) => {
    const sender = r.sender.slice(0, 200);
    const subject = r.subject.slice(0, 400);
    const snippet = (r.snippet ?? "").slice(0, 500);
    return `##${i + 1}\nid:${r.id}\nsender:${sender}\nsubject:${subject}\nsnippet:${snippet}`;
  });

  const prompt = `You classify personal inbox emails for triage.

For each message below, assign exactly ONE category:
- needs_attention — needs a decision, substantive review, or non-trivial action
- quick_reply — can be handled with a short acknowledgment or a simple yes/no / confirm
- newsletter — editorial digests, blogs, recurring reads (not pure ads)
- promotion — marketing, discounts, sales, product promos
- handled — FYI, automated receipts with nothing to do, or clearly already resolved threads

Return valid JSON only, no markdown, in this exact shape:
{"classifications":[{"id":"<message id exactly as given>","category":"needs_attention"}]}

Include one object per message, same order as below. Use only these category strings: needs_attention, quick_reply, newsletter, promotion, handled.

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
      return defaultAll("needs_attention");
    }

    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      console.error("[categorize-inbox] empty model content");
      return defaultAll("needs_attention");
    }

    let parsed: { classifications?: Array<{ id?: string; category?: string }> };
    try {
      parsed = JSON.parse(stripJsonFence(raw)) as typeof parsed;
    } catch {
      console.error("[categorize-inbox] JSON parse failed");
      return defaultAll("needs_attention");
    }

    const list = parsed.classifications;
    if (!Array.isArray(list)) {
      console.error("[categorize-inbox] missing classifications array");
      return defaultAll("needs_attention");
    }

    const byId = new Map<string, InboxAiCategory>();
    for (const item of list) {
      if (typeof item?.id === "string" && typeof item?.category === "string") {
        byId.set(item.id, normalizeInboxAiCategory(item.category));
      }
    }

    return rows.map((r) => ({
      ...r,
      category: byId.get(r.id) ?? "needs_attention",
    }));
  } catch (e) {
    console.error("[categorize-inbox]", e);
    return defaultAll("needs_attention");
  } finally {
    clearTimeout(timeoutId);
  }
}
