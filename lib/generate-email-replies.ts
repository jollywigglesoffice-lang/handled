import { getAiChatConfig } from "@/lib/ai-chat-config";
import {
  callOpenRouterChat,
  parseRepliesJson,
  readOpenRouterChatContent,
} from "@/lib/openrouter-reply";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  formatReplyContextForPrompt,
  type ReplyContextAnalysis,
} from "@/lib/reply-context-analysis";
import type { ReplyGenerationResult } from "@/lib/reply-generation-result";
import { workflowModeReplyDirective } from "@/lib/workflow-mode-effects";
import { formatUserIdentityForPrompt, resolveReplyAuthorName } from "@/lib/user-identity/format-for-prompt";
import type { UserIdentity } from "@/lib/user-identity/types";
import type { WorkflowMode } from "@/lib/workflow-mode";

export function buildGenerateReplyPrompt(input: {
  email: string;
  tone: string;
  languageLabel: string;
  userName?: string;
  identity?: UserIdentity;
  contextBlock: string;
  workflowMode?: WorkflowMode;
  category?: InboxAiCategory;
  brainContext?: string;
  replyContext?: ReplyContextAnalysis;
}): string {
  const authorName = input.identity
    ? resolveReplyAuthorName(input.identity, input.userName)
    : input.userName?.trim() ?? "";
  const identityBlock = input.identity
    ? formatUserIdentityForPrompt(input.identity, input.replyContext, input.workflowMode)
    : "";
  const modeLine = input.workflowMode
    ? workflowModeReplyDirective(input.workflowMode)
    : "";
  const categoryLine = input.category
    ? `Inbox category: ${input.category.replace(/_/g, " ")}.`
    : "";

  const analysisBlock = input.replyContext
    ? formatReplyContextForPrompt(
        input.replyContext,
        input.tone,
        input.languageLabel,
        input.workflowMode,
      )
    : "";

  const examples =
    input.replyContext?.primaryIntent === "pricing_inquiry"
      ? `
Good examples for this pricing inquiry:
- "Thanks for your interest, ${input.replyContext.extractedFacts.senderFirstName ?? "there"}. I'd be happy to send over our corporate pricing options for larger teams."
- "Absolutely — we offer enterprise pricing for companies your size. I'll prepare the details for you."
${input.replyContext.extractedFacts.employeeCount ? `- "Thanks ${input.replyContext.extractedFacts.senderFirstName ?? ""}. With ${input.replyContext.extractedFacts.employeeCount} employees, you'd qualify for our corporate tier — I'll send the breakdown shortly."`.trim() : ""}`
      : input.replyContext?.hasDirectQuestion
        ? `
Each reply must answer or commit to answer the sender's question(s). Do not only thank them for writing.`
        : "";

  return `You are Handled — a proactive executive assistant drafting email replies for ${authorName || "the user"}.

Your job is NOT smart-reply autocomplete. You understand intent, answer questions, and move conversations forward.

${identityBlock ? `${identityBlock}\n\n` : ""}${analysisBlock}

${categoryLine}
${modeLine ? `${modeLine}\n` : ""}
${input.brainContext ? `${input.brainContext}\n\n` : ""}${input.contextBlock}
${examples}

Write exactly 3 reply variations:
1. Best default (recommended send)
2. Alternate phrasing
3. Another distinct option

Rules:
- Address the sender's actual request, questions, and context (names, numbers, products)
- Match tone setting: ${input.tone}
- All three in ${input.languageLabel}
- Under 3 sentences each; one sentence if the email is simple
- Meaningfully different — not the same sentence reworded
- Write in first person as ${authorName || "the user"}${input.identity?.includeSignOffInReplies ? " and include their sign-off on every reply" : ""}
${input.brainContext ? "- When Handled Brain context is provided above: answer using those facts only; never invent details; if unsure, offer to follow up" : ""}
- These are drafts for user approval — never imply the message was already sent

Return valid JSON only:
{"replies":["reply 1","reply 2","reply 3"]}

Email to reply to:
${input.email}`;
}

export function buildReplyCorrectionPrompt(
  originalPrompt: string,
  failures: string[],
  priorReplies: string[],
): string {
  return `${originalPrompt}

IMPORTANT — your previous output failed validation:
${failures.map((f) => `- ${f}`).join("\n")}

Previous (rejected) replies:
${priorReplies.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Regenerate 3 NEW replies that fix every issue. Return JSON only: {"replies":["...","...","..."]}`;
}

async function callGenerateJson(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<ReplyGenerationResult> {
  const cfg = getAiChatConfig();
  const model = cfg?.model ?? "gpt-4o-mini";
  const provider = cfg?.provider ?? "unknown";

  const response = await callOpenRouterChat(
    apiKey,
    {
      model,
      temperature: 0.55,
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
    return {
      ok: false,
      stage: schemaError?.includes("parse") ? "json_parse" : "schema_invalid",
      message: schemaError ?? "No replies in model output",
      rawContent: content,
      provider,
      model,
    };
  }

  return {
    ok: true,
    replies,
    rawContent: content,
    provider,
    model,
  };
}

/** Non-streaming reply generation (reliable JSON). */
export async function generateEmailRepliesJson(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<ReplyGenerationResult> {
  try {
    return await callGenerateJson(apiKey, prompt, signal);
  } catch (error) {
    const isAbort =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("aborted"));
    console.error("[reply-generate] EXCEPTION:", error);
    const cfg = getAiChatConfig();
    return {
      ok: false,
      stage: isAbort ? "timeout" : "network",
      message: error instanceof Error ? error.message : String(error),
      provider: cfg?.provider,
      model: cfg?.model,
    };
  }
}

export async function generateEmailRepliesWithValidation(
  apiKey: string,
  prompt: string,
  validate: (replies: string[]) => { ok: boolean; failures: string[] },
  signal?: AbortSignal,
): Promise<ReplyGenerationResult & { validationFailures?: string[]; retried?: boolean }> {
  const first = await generateEmailRepliesJson(apiKey, prompt, signal);
  if (!first.ok) return first;

  const check = validate(first.replies);
  if (check.ok) return first;

  console.warn("[reply-generate] validation failed, retrying:", check.failures);
  const correction = buildReplyCorrectionPrompt(prompt, check.failures, first.replies);
  const second = await generateEmailRepliesJson(apiKey, correction, signal);
  if (!second.ok) {
    return { ...first, validationFailures: check.failures };
  }

  const check2 = validate(second.replies);
  if (!check2.ok) {
    console.error("[reply-generate] validation failed after retry:", check2.failures);
    return {
      ...second,
      validationFailures: check2.failures,
      retried: true,
    };
  }

  return { ...second, retried: true };
}
