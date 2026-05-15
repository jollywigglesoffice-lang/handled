import {
  callOpenRouterChat,
  parseRepliesJson,
  REPLY_MODEL,
  readOpenRouterChatContent,
} from "@/lib/openrouter-reply";
import { workflowModeReplyDirective } from "@/lib/workflow-mode-effects";
import type { WorkflowMode } from "@/lib/workflow-mode";

export function buildGenerateReplyPrompt(input: {
  email: string;
  tone: string;
  languageLabel: string;
  userName?: string;
  contextBlock: string;
  workflowMode?: WorkflowMode;
}): string {
  const modeLine = input.workflowMode
    ? workflowModeReplyDirective(input.workflowMode)
    : "";

  return `Write 3 different short reply variations to this email.

Rules:
- Keep each reply under 3 sentences
- Keep each reply short and quick
- If the email is simple, keep each reply to one sentence
- Use natural, human language, like texting a colleague
- Avoid corporate tone
- Avoid overly polite language
- Avoid sounding overly helpful
- Keep the tone ${input.tone}
- Write every reply in ${input.languageLabel}. (All three variations must be in that language.)
- Reference specific details from the email (names, dates, requests) when present
- The first reply is the recommended default
- Replies 2 and 3 must be meaningfully different phrasings
- If appropriate, make the reply sound like it was written by ${input.userName ?? "the user"}
${modeLine ? `\n${modeLine}` : ""}
${input.contextBlock}

Return valid JSON only in this exact shape:
{"replies":["recommended reply","alternate 1","alternate 2"]}

Do not include markdown. Do not include extra keys.

Email:
${input.email}`;
}

/** Non-streaming reply generation (reliable JSON). */
export async function generateEmailRepliesJson(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string[] | null> {
  try {
    const response = await callOpenRouterChat(
      apiKey,
      {
        model: REPLY_MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      },
      signal,
    );

    const { content } = await readOpenRouterChatContent(response);
    if (!content) {
      console.log("REPLY GENERATION ERROR:", "empty model content");
      return null;
    }

    const replies = parseRepliesJson(content);
    if (replies.length === 0) {
      console.log("REPLY GENERATION ERROR:", "no replies parsed", {
        preview: content.slice(0, 300),
      });
      return null;
    }

    return replies;
  } catch (error) {
    console.log("REPLY GENERATION ERROR:", error);
    return null;
  }
}
