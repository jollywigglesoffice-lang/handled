import {
  callOpenRouterChat,
  parseRepliesJson,
  REPLY_MODEL,
  readOpenRouterChatContent,
} from "@/lib/openrouter-reply";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
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

  return `Write 3 different short reply variations ONLY if a human sender realistically expects a response.

If this is promotional, newsletter, receipt, or automated — you should NOT have been asked; still return 3 brief neutral lines only if forced.

Rules:
- Reference specific details from the email (names, dates, requests)
- Natural, like texting a colleague — not corporate or marketing tone
- Each reply under 3 sentences; one sentence if the email is simple
- Tone: ${input.tone}
- Language: ${input.languageLabel} for all three
- Replies must be meaningfully different
${categoryLine}
${modeLine ? `\n${modeLine}` : ""}
${input.brainContext ? `\n${input.brainContext}\n` : ""}
${input.contextBlock}

Return valid JSON only:
{"replies":["recommended reply","alternate 1","alternate 2"]}

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
        temperature: 0.65,
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
