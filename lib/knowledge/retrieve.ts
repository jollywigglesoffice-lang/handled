import type { HandledBrain } from "@/lib/handled-brain/types";
import { formatKnowledgeForPrompt, toBrainUsageDto } from "@/lib/knowledge/format-for-prompt";
import { scoreHandledBrainEntries } from "@/lib/knowledge/providers/handled-brain";
import type {
  BrainUsageDto,
  KnowledgeRetrievalInput,
  KnowledgeRetrievalResult,
} from "@/lib/knowledge/types";

export type RetrieveKnowledgeOptions = {
  brain?: HandledBrain | null;
  maxChunks?: number;
  minScore?: number;
};

/**
 * Unified knowledge retrieval — Handled Brain today; plug additional providers here.
 * @see lib/knowledge/providers/google-calendar.ts for future Calendar availability chunks
 */
export function retrieveKnowledgeForEmail(
  input: KnowledgeRetrievalInput,
  options?: RetrieveKnowledgeOptions,
): KnowledgeRetrievalResult {
  const brain = options?.brain;
  const writingStyle = brain?.writingStyle?.trim() || undefined;
  const writingStyleUsed = Boolean(writingStyle);

  if (!brain?.entries?.length && !writingStyleUsed) {
    return {
      chunks: [],
      writingStyle,
      promptBlock: "",
      active: false,
      writingStyleUsed: false,
    };
  }

  const chunks = scoreHandledBrainEntries(brain ?? { entries: [] }, input, {
    maxResults: options?.maxChunks ?? 5,
    minScore: options?.minScore ?? 3,
  });

  const active = chunks.length > 0 || writingStyleUsed;
  const result: KnowledgeRetrievalResult = {
    chunks,
    writingStyle,
    promptBlock: "",
    active,
    writingStyleUsed,
  };

  result.promptBlock = formatKnowledgeForPrompt(result);

  if (active) {
    console.log("[knowledge] retrieved:", {
      chunks: chunks.map((c) => ({ title: c.title, score: c.score, reasons: c.matchReasons })),
      writingStyleUsed,
    });
  }

  return result;
}

export function retrieveKnowledgePromptBlock(
  input: KnowledgeRetrievalInput,
  brain?: HandledBrain | null,
): string {
  return retrieveKnowledgeForEmail(input, { brain }).promptBlock;
}

export function retrieveBrainUsageDto(
  input: KnowledgeRetrievalInput,
  brain?: HandledBrain | null,
): BrainUsageDto {
  return toBrainUsageDto(retrieveKnowledgeForEmail(input, { brain }));
}

/** Re-export for API + client parity */
export { toBrainUsageDto };
