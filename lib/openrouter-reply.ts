import { getAiChatConfig } from "@/lib/ai-chat-config";

const REPLY_MODEL = "openai/gpt-4o-mini";

export function openRouterReferer(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv?.startsWith("http")) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fence?.[1]?.trim() ?? t;
}

export function extractJsonObject(text: string): string | null {
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

type OpenRouterChatBody = {
  model: string;
  temperature?: number;
  stream?: boolean;
  response_format?: { type: "json_object" };
  messages: Array<{ role: string; content: string }>;
};

export async function callOpenRouterChat(
  apiKey: string,
  body: OpenRouterChatBody,
  signal?: AbortSignal,
  options?: { model?: string; baseUrl?: string; provider?: string },
): Promise<Response> {
  const cfg = getAiChatConfig();
  const model = options?.model ?? body.model ?? cfg?.model ?? REPLY_MODEL;
  const baseUrl = options?.baseUrl ?? cfg?.baseUrl ?? "https://openrouter.ai/api/v1/chat/completions";
  const provider = options?.provider ?? cfg?.provider ?? "openrouter";

  const requestBody = {
    model,
    temperature: body.temperature ?? 0.7,
    stream: body.stream ?? false,
    ...(body.response_format ? { response_format: body.response_format } : {}),
    messages: body.messages,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = openRouterReferer();
    headers["X-Title"] = "Handled App";
  }

  console.log("[ai-chat] REQUEST:", {
    provider,
    baseUrl,
    model: requestBody.model,
    stream: requestBody.stream,
    temperature: requestBody.temperature,
    response_format: body.response_format?.type,
    promptChars: body.messages[0]?.content?.length ?? 0,
  });

  const response = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal,
  });

  return response;
}

export async function readOpenRouterChatContent(
  response: Response,
): Promise<{ content: string | null; raw: unknown }> {
  const rawText = await response.text();
  let raw: unknown;
  try {
    raw = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    console.error("[ai-chat] RESPONSE NOT JSON:", {
      status: response.status,
      preview: rawText.slice(0, 400),
      error: String(error),
    });
    return { content: null, raw: { parseError: String(error), bodyPreview: rawText.slice(0, 500) } };
  }

  console.log("[ai-chat] RESPONSE:", {
    ok: response.ok,
    status: response.status,
    choices: (raw as { choices?: unknown[] })?.choices?.length ?? 0,
    error: (raw as { error?: { message?: string; code?: string } })?.error,
    usage: (raw as { usage?: unknown })?.usage,
  });

  if (!response.ok) {
    console.error("[ai-chat] HTTP ERROR:", JSON.stringify(raw, null, 2).slice(0, 2000));
    return { content: null, raw };
  }

  const content = (
    raw as { choices?: Array<{ message?: { content?: string } }> }
  )?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    console.error("[ai-chat] EMPTY CONTENT:", {
      finish_reason: (raw as { choices?: Array<{ finish_reason?: string }> })?.choices?.[0]
        ?.finish_reason,
      rawPreview: JSON.stringify(raw).slice(0, 500),
    });
  } else {
    console.log("[ai-chat] RAW CONTENT PREVIEW:", content.slice(0, 400));
  }

  return { content: content ?? null, raw };
}

export function parseRepliesJson(content: string): {
  replies: string[];
  schemaError?: string;
} {
  const stripped = stripJsonFence(content);
  const jsonText = extractJsonObject(stripped) ?? stripped;

  try {
    const parsed = JSON.parse(jsonText) as {
      replies?: unknown;
      reply?: unknown;
      variations?: unknown;
    };

    if (Array.isArray(parsed.replies)) {
      const replies = parsed.replies
        .map((r) => (typeof r === "string" ? r.trim() : ""))
        .filter((r) => r.length > 0)
        .slice(0, 3);
      if (replies.length > 0) {
        return { replies };
      }
      return { replies: [], schemaError: "replies array was empty" };
    }

    if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      return { replies: [parsed.reply.trim()] };
    }

    if (Array.isArray(parsed.variations)) {
      const replies = parsed.variations
        .map((r) => (typeof r === "string" ? r.trim() : ""))
        .filter((r) => r.length > 0)
        .slice(0, 3);
      if (replies.length > 0) {
        return { replies };
      }
    }

    return {
      replies: [],
      schemaError: `unexpected JSON shape: ${Object.keys(parsed as object).join(", ") || "no keys"}`,
    };
  } catch (error) {
    console.error("[ai-chat] JSON PARSE FAILED:", error, {
      preview: content.slice(0, 300),
    });
  }

  const lineFallback = content
    .split("\n")
    .map((line) => line.trim().replace(/^["'\-\d.\)\s]+/, ""))
    .filter((line) => line.length > 10)
    .slice(0, 3);

  return {
    replies: lineFallback,
    schemaError: lineFallback.length ? undefined : "could not parse JSON or line-split content",
  };
}

export const REPLY_STREAM_SEPARATOR = "---REPLY---";
export { REPLY_MODEL };
