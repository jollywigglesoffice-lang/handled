import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { getAiApiKey } from "@/lib/ai-api-key";
import {
  callOpenRouterChat,
  readOpenRouterChatContent,
  REPLY_MODEL,
} from "@/lib/openrouter-reply";
import { analyzeEmailIntent } from "@/lib/email-intent";
import { emailHaystack, isCommercialBulk } from "@/lib/inbox-triage-signals";
import { buildSituationSummary } from "@/lib/situational-understanding";
import type { WorkflowMode } from "@/lib/workflow-mode";

/** Calm, human situation line — delegates to situational understanding. */
export function heuristicEmailSummary(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
  locale: "en" | "it" = "en",
): string {
  return buildSituationSummary(row, category, { category, locale });
}

function buildSummaryPrompt(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
  workflowMode: WorkflowMode,
  locale: "en" | "it",
): string {
  return `Write ONE sentence that explains the situation to a busy professional — like a calm executive assistant briefing them.

Forbidden phrases (never use):
- "needs attention", "likely needs a reply", "scheduling request detected"
- "AI", "classifier", "category", "automated update", "review if a response is needed"
- marketing hype or exclamation-heavy tone

Required style:
- Name who wrote (${locale === "it" ? "es." : "e.g."} "Studio Medico Ferrara needs you to choose a new appointment time")
- What they want or what happened
- Max 22 words, neutral, confident, plain language

Context (internal only, do not repeat labels):
- Inbox bucket: ${category.replace(/_/g, " ")}
- Workflow: ${workflowMode}

Email:
From: ${row.sender}
Subject: ${row.subject}
Preview: ${row.snippet ?? ""}

Return plain text only. One sentence.`;
}

export async function buildEmailSummary(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
  workflowMode: WorkflowMode = "assist",
  locale: "en" | "it" = "en",
): Promise<string> {
  const fallback = heuristicEmailSummary(row, category, locale);

  const apiKey = getAiApiKey();
  if (!apiKey) {
    return fallback;
  }

  const intent = analyzeEmailIntent(row as GmailInboxRow);
  if (intent.highPriority) {
    return fallback;
  }

  if (
    (category === "promotion" || category === "newsletter" || category === "handled") &&
    isCommercialBulk(row as GmailInboxRow)
  ) {
    return fallback;
  }

  try {
    const response = await callOpenRouterChat(apiKey, {
      model: REPLY_MODEL,
      temperature: 0.35,
      messages: [{ role: "user", content: buildSummaryPrompt(row, category, workflowMode, locale) }],
    });
    const { content } = await readOpenRouterChatContent(response);
    if (!content) return fallback;

    const line = content.split("\n")[0]?.trim() ?? "";
    if (line.length < 8 || line.length > 200) return fallback;
    const lower = line.toLowerCase();
    if (
      /unlock|journey|needs attention|scheduling request detected|likely needs|automated update|ai generated/i.test(
        lower,
      )
    ) {
      return fallback;
    }
    return line;
  } catch {
    return fallback;
  }
}
