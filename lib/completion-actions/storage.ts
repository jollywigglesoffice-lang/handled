import { SYSTEM_COMPLETION_ACTION_IDS } from "@/lib/completion-actions/types";
import {
  isPersonalCompletionActionId,
  personalCompletionIdFromLabel,
} from "@/lib/completion-actions/slug";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import {
  MAX_PERSONAL_COMPLETION_ACTIONS,
  type PersonalCompletionAction,
} from "@/lib/completion-actions/types";

const SYSTEM_SLUGS = new Set(
  SYSTEM_COMPLETION_ACTION_IDS.map((id) => id.toLowerCase()),
);

export function parsePersonalCompletionActionsJson(raw: unknown): PersonalCompletionAction[] {
  if (!Array.isArray(raw)) return [];
  const out: PersonalCompletionAction[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label || label.length > 56) continue;

    const id =
      typeof row.id === "string" && isPersonalCompletionActionId(row.id)
        ? row.id
        : personalCompletionIdFromLabel(label);

    const slug = id.slice("custom:".length);
    if (SYSTEM_SLUGS.has(slug)) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const now = Date.now();
    out.push({
      id: id as CompletionActionId,
      label,
      labelIt: typeof row.labelIt === "string" ? row.labelIt.trim() || undefined : undefined,
      sortOrder:
        typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder)
          ? row.sortOrder
          : out.length,
      createdAt: typeof row.createdAt === "number" ? row.createdAt : now,
      updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : now,
    });

    if (out.length >= MAX_PERSONAL_COMPLETION_ACTIONS) break;
  }

  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function normalizePersonalCompletionActions(
  list: PersonalCompletionAction[],
): PersonalCompletionAction[] {
  return parsePersonalCompletionActionsJson(list);
}

export function createPersonalCompletionAction(
  label: string,
  existing: PersonalCompletionAction[],
): { ok: true; action: PersonalCompletionAction } | { ok: false; error: string } {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  if (existing.length >= MAX_PERSONAL_COMPLETION_ACTIONS) {
    return {
      ok: false,
      error: `You can add up to ${MAX_PERSONAL_COMPLETION_ACTIONS} custom actions.`,
    };
  }
  const id = personalCompletionIdFromLabel(trimmed);
  if (existing.some((a) => a.id === id)) {
    return { ok: false, error: "You already have an action with that name." };
  }
  const now = Date.now();
  return {
    ok: true,
    action: {
      id: id as CompletionActionId,
      label: trimmed,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    },
  };
}
