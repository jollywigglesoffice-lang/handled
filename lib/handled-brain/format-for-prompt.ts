import type { HandledBrain } from "@/lib/handled-brain/types";
import type { BrainEntry } from "@/lib/handled-brain/types";
import { retrieveKnowledgeForEmail } from "@/lib/knowledge/retrieve";
import type { KnowledgeRetrievalInput } from "@/lib/knowledge/types";

/** @deprecated Use retrieveKnowledgeForEmail — kept for backward compatibility */
export function formatHandledBrainForPrompt(brain: HandledBrain | null | undefined): string {
  return retrieveKnowledgeForEmail({ emailText: "" }, { brain }).promptBlock;
}

export function selectRelevantBrainEntries(
  brain: HandledBrain,
  emailText: string,
): BrainEntry[] {
  const result = retrieveKnowledgeForEmail(
    { emailText },
    { brain, maxChunks: 8, minScore: 2 },
  );
  return result.chunks.map((c) => ({
    id: c.id,
    category: (c.category ?? "general") as BrainEntry["category"],
    title: c.title,
    content: c.content,
    updatedAt: c.updatedAt ?? Date.now(),
  }));
}

export function formatRelevantBrainForPrompt(
  brain: HandledBrain | null | undefined,
  emailText: string,
  extra?: Pick<KnowledgeRetrievalInput, "subject" | "primaryIntent" | "intentKinds">,
): string {
  if (!brain?.entries?.length && !brain?.writingStyle?.trim()) return "";
  return retrieveKnowledgeForEmail(
    {
      emailText,
      subject: extra?.subject,
      primaryIntent: extra?.primaryIntent,
      intentKinds: extra?.intentKinds,
    },
    { brain },
  ).promptBlock;
}
