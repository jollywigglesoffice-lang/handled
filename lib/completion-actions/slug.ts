import type { CompletionActionId } from "@/lib/completion-actions/types";

export const PERSONAL_COMPLETION_PREFIX = "custom:" as const;

export function slugifyCompletionActionLabel(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "action";
}

export function personalCompletionIdFromLabel(label: string): CompletionActionId {
  return `${PERSONAL_COMPLETION_PREFIX}${slugifyCompletionActionLabel(label)}` as CompletionActionId;
}

export function isPersonalCompletionActionId(value: string): boolean {
  return value.startsWith(PERSONAL_COMPLETION_PREFIX);
}
