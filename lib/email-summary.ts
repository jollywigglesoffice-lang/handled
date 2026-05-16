import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { getAiApiKey } from "@/lib/ai-api-key";
import {
  callOpenRouterChat,
  readOpenRouterChatContent,
  REPLY_MODEL,
} from "@/lib/openrouter-reply";
import { emailHaystack, isCommercialBulk } from "@/lib/inbox-triage-signals";
import type { WorkflowMode } from "@/lib/workflow-mode";

function topicFromSubject(subject: string): string {
  const s = subject.replace(/^(re|fwd?):\s*/gi, "").trim();
  if (s.length <= 80) return s.toLowerCase();
  return `${s.slice(0, 77).trim()}…`;
}

/** Calm, human, neutral one-liner — no marketing voice. */
export function heuristicEmailSummary(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
): string {
  const subject = (row.subject ?? "").trim();
  const topic = topicFromSubject(subject || "this message");
  const hay = emailHaystack(row as GmailInboxRow);

  if (category === "promotion") {
    if (/instagram|tiktok|facebook|linkedin/i.test(hay)) {
      return "Social app notification. Likely non-urgent.";
    }
    return `Marketing email about ${topic}. No action needed.`;
  }

  if (category === "newsletter") {
    return `Newsletter or digest${subject ? `: ${topic}` : ""}. Read later if interested.`;
  }

  if (category === "handled") {
    if (/receipt|invoice|payment received|charged/i.test(hay)) {
      return "Payment or receipt. No reply needed.";
    }
    if (/shipped|tracking|delivery|order confirmed/i.test(hay)) {
      return "Shipping or order update. No reply needed.";
    }
    return "Automated update. No action required.";
  }

  if (category === "quick_reply") {
    return `Short message${subject ? ` about ${topic}` : ""}. A brief reply may be enough.`;
  }

  if (/school|scuola|teacher|student/i.test(hay)) {
    return `School-related message${subject ? `: ${topic}` : ""}. May need attention.`;
  }

  if (/doctor|clinic|hospital|ospedale|appointment/i.test(hay)) {
    return `Health or clinic message${subject ? `: ${topic}` : ""}. Worth reviewing.`;
  }

  return `Personal or work message${subject ? `: ${topic}` : ""}. Review if a response is needed.`;
}

function buildSummaryPrompt(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
  workflowMode: WorkflowMode,
): string {
  return `Write ONE calm sentence summarizing this email for the user's inbox.

Tone rules (critical):
- Sound like a thoughtful assistant, NOT marketing copy
- No hype, no exclamation-heavy phrases, no "unlock", "journey", "no question about it"
- Neutral, concise, factual
- Max 22 words

Context:
- Category: ${category.replace(/_/g, " ")}
- Workflow mode: ${workflowMode}
- If promotional/newsletter/handled: state no action needed
- If needs attention: say what it's about and that it may need a response

Good examples:
- "Marketing email about book sales income. No action needed."
- "Instagram notification. Likely non-urgent."
- "School email mentioning Seba. May need your attention."

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
): Promise<string> {
  const fallback = heuristicEmailSummary(row, category);

  const apiKey = getAiApiKey();
  if (!apiKey) {
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
      temperature: 0.3,
      messages: [{ role: "user", content: buildSummaryPrompt(row, category, workflowMode) }],
    });
    const { content } = await readOpenRouterChatContent(response);
    if (!content) return fallback;

    const line = content.split("\n")[0]?.trim() ?? "";
    if (line.length < 8 || line.length > 200) return fallback;
    if (/unlock|journey|no question about it|productivity/i.test(line.toLowerCase())) {
      return fallback;
    }
    return line;
  } catch {
    return fallback;
  }
}
