import type { BrainEntry, HandledBrain } from "@/lib/handled-brain/types";
import { BRAIN_CATEGORY_LABELS } from "@/lib/handled-brain/types";

const MAX_ENTRIES = 12;
const MAX_CHARS_PER_ENTRY = 600;

function entryBlock(entry: BrainEntry): string {
  const label = BRAIN_CATEGORY_LABELS[entry.category] ?? entry.category;
  const body = entry.content.trim().slice(0, MAX_CHARS_PER_ENTRY);
  return `- [${label}] ${entry.title}: ${body}`;
}

/** Format Handled Brain for reply generation — only non-empty entries. */
export function formatHandledBrainForPrompt(brain: HandledBrain | null | undefined): string {
  if (!brain?.entries?.length && !brain?.writingStyle?.trim()) {
    return "";
  }

  const parts: string[] = [
    "HANDLED BRAIN (user's private knowledge — use when relevant, never invent facts not listed here):",
  ];

  if (brain.writingStyle?.trim()) {
    parts.push(`Writing style: ${brain.writingStyle.trim()}`);
  }

  const entries = brain.entries
    .filter((e) => e.content.trim().length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ENTRIES);

  for (const entry of entries) {
    parts.push(entryBlock(entry));
  }

  if (entries.length === 0 && !brain.writingStyle?.trim()) {
    return "";
  }

  parts.push(
    "When the email asks about pricing, policies, hours, family, or business details, prefer facts from Handled Brain. If Brain has no answer, say you'll follow up — do not fabricate.",
  );

  return parts.join("\n");
}

/** Pick entries whose title/content might match the email (simple keyword overlap). */
export function selectRelevantBrainEntries(
  brain: HandledBrain,
  emailText: string,
): BrainEntry[] {
  const hay = emailText.toLowerCase();
  const tokens = hay.split(/\W+/).filter((t) => t.length > 3);

  const scored = brain.entries
    .filter((e) => e.content.trim())
    .map((entry) => {
      const blob = `${entry.title} ${entry.content}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (blob.includes(t)) score += 1;
      }
      if (/pric|plan|cost|refund|policy|hour|address|appointment|seba|school/i.test(hay)) {
        if (entry.category === "pricing" && /pric|plan|cost/i.test(hay)) score += 3;
        if (entry.category === "policies" && /refund|policy/i.test(hay)) score += 3;
        if (entry.category === "family_school" && /seba|school|kid/i.test(hay)) score += 3;
      }
      return { entry, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.slice(0, 8).map((x) => x.entry);
  }

  return brain.entries.filter((e) => e.content.trim()).slice(0, 6);
}

export function formatRelevantBrainForPrompt(
  brain: HandledBrain | null | undefined,
  emailText: string,
): string {
  if (!brain?.entries?.length && !brain?.writingStyle?.trim()) return "";
  const relevant = selectRelevantBrainEntries(brain ?? { entries: [] }, emailText);
  return formatHandledBrainForPrompt({
    entries: relevant,
    writingStyle: brain?.writingStyle,
  });
}
