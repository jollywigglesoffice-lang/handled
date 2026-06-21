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
  return `Write ONE extractive sentence describing ONLY what is explicitly in this email.

STRICT RULES:
- Do NOT infer intent, urgency, or required actions unless the exact words appear in the email.
- Do NOT say someone "needs", "wants", "is asking", or "is trying to schedule" unless they literally ask.
- Staff announcements, newsletters, and FYI updates are NOT action requests.
- Use the sender name, subject line, and preview text — nothing else.
- If inference is unavoidable, prefix with "Possible intent:" (never state it as fact).
- Max 28 words, neutral tone, plain language.

Forbidden phrases:
- "needs attention", "likely needs a reply", "scheduling request", "trying to schedule"
- "needs confirmation", "worth a reply", "action required" (unless quoted from email)

Context (internal only — do not repeat):
- Bucket: ${category.replace(/_/g, " ")}
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
    (category === "promotions" || category === "newsletters" || category === "good_to_know") &&
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
      /unlock|journey|needs attention|scheduling request|trying to schedule|likely needs|needs confirmation|needs you to|is asking|automated update|ai generated/i.test(
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
