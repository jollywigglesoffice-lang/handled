import { getAiChatConfig } from "@/lib/ai-chat-config";
import {
  callOpenRouterChat,
  parseRepliesJson,
  readOpenRouterChatContent,
} from "@/lib/openrouter-reply";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { ReplyGenerationResult } from "@/lib/reply-generation-result";
import { workflowModeReplyDirective } from "@/lib/workflow-mode-effects";
import type { WorkflowMode } from "@/lib/workflow-mode";

export function buildGenerateReplyPrompt(input: {
  email: string;
  tone: string;
  languageLabel: string;
  userName?: string;
  contextBlock: string;
  workflowMode?: WorkflowMode;
  category?: InboxAiCategory;
  brainContext?: string;
}): string {
  const modeLine = input.workflowMode
    ? workflowModeReplyDirective(input.workflowMode)
    : "";
  const categoryLine = input.category
    ? `Email category: ${input.category.replace(/_/g, " ")}.`
    : "";

  return `You write 3 short reply variations for a real inbound email. Each reply must directly address what the sender asked or offered — never generic acknowledgements like "Got it, thanks" unless the email truly needs only that.

Requirements:
- Read the email carefully: names, numbers, product asks, deadlines, questions
- If they ask for pricing, a demo, partnership, or enterprise details — acknowledge the specific request and offer a concrete next step (e.g. send pricing, schedule a call)
- If they ask questions — answer or commit to answering those questions
- Use the sender's name when it appears in the email
- Natural, human tone — like a capable colleague, not marketing copy
- Each reply under 3 sentences; one sentence if the email is simple
- Tone setting: ${input.tone}
- Language: ${input.languageLabel} for all three
- The 3 replies must be meaningfully different (not paraphrases of the same line)
${categoryLine}
${modeLine ? `\n${modeLine}` : ""}
${input.brainContext ? `\n${input.brainContext}\n` : ""}
${input.contextBlock}

Return valid JSON only, no markdown:
{"replies":["best reply","alternate 1","alternate 2"]}

Email:
${input.email}`;
}

/** Non-streaming reply generation (reliable JSON). */
export async function generateEmailRepliesJson(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<ReplyGenerationResult> {
  const cfg = getAiChatConfig();
  const model = cfg?.model ?? "gpt-4o-mini";
  const provider = cfg?.provider ?? "unknown";

  try {
    const response = await callOpenRouterChat(
      apiKey,
      {
        model,
        temperature: 0.65,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      },
      signal,
    );

    const { content, raw } = await readOpenRouterChatContent(response);

    if (!response.ok) {
      const errMsg =
        (raw as { error?: { message?: string } })?.error?.message ??
        `Upstream HTTP ${response.status}`;
      console.error("[reply-generate] HTTP ERROR:", {
        status: response.status,
        provider,
        model,
        error: errMsg,
        raw,
      });
      return {
        ok: false,
        stage: "http_error",
        message: errMsg,
        httpStatus: response.status,
        rawUpstream: raw,
        provider,
        model,
      };
    }

    if (!content) {
      return {
        ok: false,
        stage: "empty_content",
        message: "Model returned no message content",
        rawUpstream: raw,
        provider,
        model,
      };
    }

    const { replies, schemaError } = parseRepliesJson(content);

    if (replies.length === 0) {
      console.error("[reply-generate] PARSE FAILED:", {
        schemaError,
        preview: content.slice(0, 400),
      });
      return {
        ok: false,
        stage: schemaError?.includes("parse") ? "json_parse" : "schema_invalid",
        message: schemaError ?? "No replies in model output",
        rawContent: content,
        provider,
        model,
      };
    }

    if (replies.length < 3) {
      console.warn("[reply-generate] fewer than 3 replies:", replies.length, schemaError);
    }

    return {
      ok: true,
      replies,
      rawContent: content,
      provider,
      model,
    };
  } catch (error) {
    const isAbort =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("aborted"));
    console.error("[reply-generate] EXCEPTION:", error);
    return {
      ok: false,
      stage: isAbort ? "timeout" : "network",
      message: error instanceof Error ? error.message : String(error),
      provider,
      model,
    };
  }
}
