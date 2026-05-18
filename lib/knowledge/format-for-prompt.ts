import { BRAIN_CATEGORY_LABELS } from "@/lib/handled-brain/types";
import type { KnowledgeRetrievalResult, ScoredKnowledgeChunk } from "@/lib/knowledge/types";

const MAX_CHARS_PER_ENTRY = 700;

function formatEntryBlock(chunk: ScoredKnowledgeChunk): string {
  const label =
    chunk.category && chunk.category in BRAIN_CATEGORY_LABELS
      ? BRAIN_CATEGORY_LABELS[chunk.category as keyof typeof BRAIN_CATEGORY_LABELS]
      : String(chunk.category ?? "Knowledge");
  const body = chunk.content.trim().slice(0, MAX_CHARS_PER_ENTRY);
  return `- ${chunk.title} (${label}):\n  ${body.replace(/\n/g, "\n  ")}`;
}

export function formatKnowledgeForPrompt(result: KnowledgeRetrievalResult): string {
  if (!result.active && !result.writingStyleUsed) {
    return "";
  }

  const parts: string[] = [
    "## Relevant Handled Brain context",
    "Use ONLY the facts below when they answer the sender's question. If Brain has no answer, say you will confirm or follow up — NEVER invent prices, policies, dates, or commitments.",
    "The user must review and approve every reply before anything is sent.",
  ];

  if (result.writingStyleUsed && result.writingStyle?.trim()) {
    parts.push("", `Writing style: ${result.writingStyle.trim()}`);
  }

  if (result.chunks.length > 0) {
    parts.push("", "Knowledge:");
    for (const chunk of result.chunks) {
      parts.push(formatEntryBlock(chunk));
    }
  }

  parts.push(
    "",
    "Brain rules:",
    "- Sound human, concise, and action-oriented",
    "- Cite specific numbers or policy lines only when they appear above",
    "- Do not claim features, discounts, or exceptions not listed above",
  );

  return parts.join("\n");
}

export function toBrainUsageDto(result: KnowledgeRetrievalResult) {
  return {
    active: result.active,
    writingStyleUsed: result.writingStyleUsed,
    entries: result.chunks.map((c) => ({
      id: c.id,
      source: c.source,
      title: c.title,
      category: String(c.category ?? "general"),
      contentPreview: c.content.slice(0, 280),
      score: Math.round(c.score * 10) / 10,
      matchReasons: c.matchReasons,
    })),
  };
}
