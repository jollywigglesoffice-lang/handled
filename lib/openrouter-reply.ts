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
): Promise<Response> {
  const requestBody = {
    model: body.model,
    temperature: body.temperature ?? 0.7,
    stream: body.stream ?? false,
    ...(body.response_format ? { response_format: body.response_format } : {}),
    messages: body.messages,
  };

  console.log("OPENAI REQUEST:", {
    model: requestBody.model,
    stream: requestBody.stream,
    temperature: requestBody.temperature,
    response_format: body.response_format?.type,
    promptChars: body.messages[0]?.content?.length ?? 0,
    referer: openRouterReferer(),
  });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": openRouterReferer(),
      "X-Title": "Handled App",
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  return response;
}

export async function readOpenRouterChatContent(
  response: Response,
): Promise<{ content: string | null; raw: unknown }> {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    console.log("REPLY GENERATION ERROR:", "upstream response not JSON", error);
    return { content: null, raw: null };
  }

  console.log("OPENAI RESPONSE:", {
    ok: response.ok,
    status: response.status,
    choices: (raw as { choices?: unknown[] })?.choices?.length ?? 0,
    error: (raw as { error?: { message?: string } })?.error,
  });

  if (!response.ok) {
    console.log("REPLY GENERATION ERROR:", "upstream HTTP error", raw);
    return { content: null, raw };
  }

  const content = (
    raw as { choices?: Array<{ message?: { content?: string } }> }
  )?.choices?.[0]?.message?.content?.trim();

  return { content: content ?? null, raw };
}

export function parseRepliesJson(content: string): string[] {
  const stripped = stripJsonFence(content);
  const jsonText = extractJsonObject(stripped) ?? stripped;

  try {
    const parsed = JSON.parse(jsonText) as { replies?: string[] };
    if (Array.isArray(parsed.replies)) {
      return parsed.replies
        .map((r) => (typeof r === "string" ? r.trim() : ""))
        .filter((r) => r.length > 0)
        .slice(0, 3);
    }
  } catch (error) {
    console.log("REPLY GENERATION ERROR:", "JSON parse failed", error, {
      preview: content.slice(0, 200),
    });
  }

  return content
    .split("\n")
    .map((line) => line.trim().replace(/^["'\-\d.\)\s]+/, ""))
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

export const REPLY_STREAM_SEPARATOR = "---REPLY---";
export { REPLY_MODEL };
