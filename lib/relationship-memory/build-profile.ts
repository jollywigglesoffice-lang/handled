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
  waitingOnLabel,
  waitingStartAt,
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
  const activeWaiting = senderRecords.filter(isActiveWaiting);
  const historyRecords = senderRecords.filter((r) => !isActiveWaiting(r));

  const hasManualRelationship = relationship?.source === "manual";
  if (senderRecords.length === 0 && !hasManualRelationship) {
    return null;
  }

  const categoryCounts: Record<string, number> = {};
  for (const r of senderRecords) {
    categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
  }
  const topCategoryId = dominantKey<InboxAiCategory>(categoryCounts);
  const typicalCategory = topCategoryId
    ? inboxCategoryTitle(topCategoryId, locale, catalog)
    : null;

  const actionCounts: Record<string, number> = {};
  for (const r of historyRecords) {
    if (r.actionId === "waiting_on_someone") continue;
    actionCounts[r.actionId] = (actionCounts[r.actionId] ?? 0) + 1;
  }
  const topActionId = dominantKey<CompletionActionId>(actionCounts);
  const typicalCompletion = topActionId
    ? historyRecords.find((r) => r.actionId === topActionId)?.actionLabel ?? null
    : null;

  const lastMs = lastInteractionMs(senderRecords, currentEmailMs);
  const lastInteractionLabel =
    lastMs != null
      ? locale === "it"
        ? `Ultima email: ${formatRelativePast(lastMs, locale, now)}`
        : `Last email: ${formatRelativePast(lastMs, locale, now)}`
      : null;

  const waitingItems = activeWaiting.map((r) => {
    const who = waitingOnLabel(r, locale);
    const started = waitingStartAt(r);
    const relative = formatRelativePast(started, locale, now);
    const status = hasWaitingResponse(r) ? "response_received" as const : "waiting" as const;
    const label =
      status === "response_received"
        ? locale === "it"
          ? `In attesa di risposta da ${who}`
          : `Waiting on response from ${who}`
        : locale === "it"
          ? `In attesa di ${who}`
          : `Waiting on ${who}`;
    return {
      emailId: r.emailId,
      label,
      status,
      relative:
        locale === "it" ? `Inviata: ${relative}` : `Sent: ${relative}`,
    };
  });

  const recentActivity = [...senderRecords]
    .sort(
      (a, b) =>
        (b.waitingResponseAt ?? b.waitingResolvedAt ?? b.completedAt) -
        (a.waitingResponseAt ?? a.waitingResolvedAt ?? a.completedAt),
    )
    .slice(0, 3)
    .map((r) => ({
      emailId: r.emailId,
      subject: r.subject || (locale === "it" ? "(senza oggetto)" : "(no subject)"),
      actionLabel: r.actionLabel,
      relative: formatRelativePast(
        r.waitingResponseAt ?? r.waitingResolvedAt ?? r.completedAt,
        locale,
        now,
      ),
    }));

  return {
    profileName: profileDisplayName(senderLine, relationship),
    typicalCategory,
    typicalCategoryId: topCategoryId,
    typicalCompletion,
    lastInteractionLabel,
    waitingItems,
    recentActivity,
    interactionCount: senderRecords.length,
  };
}
