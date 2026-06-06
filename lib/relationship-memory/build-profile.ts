import type { CompletionActionId } from "@/lib/completion-actions/types";
import type { EmailCompletionMap, EmailCompletionRecord } from "@/lib/email-completions/types";
import type { InboxCategoryCatalog } from "@/lib/inbox-category-catalog";
import { inboxCategoryTitle } from "@/lib/inbox-category-catalog";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { senderLinesMatch } from "@/lib/relationship-memory/match-sender";
import type { SenderRelationshipMemory } from "@/lib/relationship-memory/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";
import {
  formatRelativeReceived,
  hasWaitingResponse,
  isActiveWaiting,
} from "@/lib/waiting-on/helpers";

function formatRelativePast(ms: number, locale: "en" | "it", now = Date.now()): string {
  return formatRelativeReceived(ms, locale, now);
}

function dominantKey<T extends string>(
  counts: Record<string, number>,
  minSamples = 1,
): T | null {
  const entries = Object.entries(counts).filter(([, n]) => n >= minSamples);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0] as T;
}

function recordsForSender(
  completions: EmailCompletionMap,
  senderLine: string,
): EmailCompletionRecord[] {
  return Object.values(completions).filter((r) => senderLinesMatch(r.sender, senderLine));
}

function profileDisplayName(
  senderLine: string,
  relationship?: SenderRelationshipProfile | null,
): string {
  if (relationship?.label && relationship.label !== "Client") {
    return relationship.label;
  }
  const identity = resolveSenderIdentity(senderLine);
  if (identity.displayName) return identity.displayName;
  if (identity.email) return identity.email.split("@")[0] ?? identity.email;
  return senderLine.trim() || "Sender";
}

function lastInteractionMs(
  records: EmailCompletionRecord[],
  currentEmailMs?: number,
): number | null {
  let max: number | null = typeof currentEmailMs === "number" ? currentEmailMs : null;
  for (const r of records) {
    const t = r.waitingResponseAt ?? r.waitingResolvedAt ?? r.completedAt;
    if (t && (max == null || t > max)) max = t;
  }
  return max;
}

function waitingOnSummary(
  activeWaiting: EmailCompletionRecord[],
  locale: "en" | "it",
): string | null {
  if (!activeWaiting.length) return null;

  const withResponse = activeWaiting.filter(hasWaitingResponse);
  const open = activeWaiting.length - withResponse.length;

  if (withResponse.length > 0 && open === 0) {
    return locale === "it"
      ? withResponse.length === 1
        ? "1 risposta"
        : `${withResponse.length} risposte`
      : withResponse.length === 1
        ? "1 response"
        : `${withResponse.length} responses`;
  }

  if (open > 0) {
    const n = open + withResponse.length;
    return locale === "it"
      ? n === 1
        ? "1 voce in attesa"
        : `${n} voci in attesa`
      : n === 1
        ? "1 open item"
        : `${n} open items`;
  }

  return null;
}

/** At least two memory signals before surfacing in the UI. */
export function hasEnoughRelationshipMemory(memory: SenderRelationshipMemory): boolean {
  const signals = [
    memory.typicalCategory,
    memory.typicalCompletion,
    memory.lastInteraction,
    memory.waitingOnSummary,
  ].filter(Boolean).length;
  return signals >= 2;
}

export function buildSenderRelationshipMemory(input: {
  senderLine: string;
  completions: EmailCompletionMap;
  relationship?: SenderRelationshipProfile | null;
  locale: "en" | "it";
  catalog: InboxCategoryCatalog;
  currentEmailMs?: number;
  now?: number;
}): SenderRelationshipMemory | null {
  const {
    senderLine,
    completions,
    relationship,
    locale,
    catalog,
    currentEmailMs,
    now = Date.now(),
  } = input;

  const senderRecords = recordsForSender(completions, senderLine);
  if (senderRecords.length === 0) return null;

  const activeWaiting = senderRecords.filter(isActiveWaiting);
  const historyRecords = senderRecords.filter((r) => !isActiveWaiting(r));

  const minPatternSamples = senderRecords.length >= 2 ? 2 : 1;

  const categoryCounts: Record<string, number> = {};
  for (const r of senderRecords) {
    categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
  }
  const topCategoryId = dominantKey<InboxAiCategory>(categoryCounts, minPatternSamples);
  const typicalCategory = topCategoryId
    ? inboxCategoryTitle(topCategoryId, locale, catalog)
    : null;

  const actionCounts: Record<string, number> = {};
  for (const r of historyRecords) {
    if (r.actionId === "waiting_on_someone") continue;
    actionCounts[r.actionId] = (actionCounts[r.actionId] ?? 0) + 1;
  }
  const topActionId = dominantKey<CompletionActionId>(actionCounts, minPatternSamples);
  const typicalCompletion = topActionId
    ? historyRecords.find((r) => r.actionId === topActionId)?.actionLabel ?? null
    : null;

  const lastMs = lastInteractionMs(senderRecords, currentEmailMs);
  const lastInteraction = lastMs != null ? formatRelativePast(lastMs, locale, now) : null;

  const memory: SenderRelationshipMemory = {
    profileName: profileDisplayName(senderLine, relationship),
    typicalCategory,
    typicalCategoryId: topCategoryId,
    typicalCompletion,
    lastInteraction,
    waitingOnSummary: waitingOnSummary(activeWaiting, locale),
    interactionCount: senderRecords.length,
  };

  return hasEnoughRelationshipMemory(memory) ? memory : null;
}
