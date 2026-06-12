import type { CompletionActionId } from "@/lib/completion-actions/types";
import { addDismissedIds, removeDismissedIds } from "@/lib/dismissed/client-storage";
import { scopedEmailKey } from "@/lib/gmail/account-types";
import { markEmailsRead } from "@/lib/read-state/gmail-sync";

/**
 * Gmail message ids are only unique within one mailbox — callers that know
 * the source account should pass `{ id, accountId }` so dismissed entries are
 * account-scoped and Gmail sync targets the right mailbox.
 */
export type DoneEmailRef = string | { id: string; accountId?: string };

function toEntry(ref: DoneEmailRef): { id: string; accountId?: string } {
  return typeof ref === "string" ? { id: ref } : ref;
}

/**
 * Standard Gmail-trusted side effects after Done / completion is persisted.
 * - Marks read locally and syncs UNREAD removal to Gmail.
 * - Dismisses from the inbox list (except active Waiting On — completion map hides those).
 */
export function applyDoneInboxEffects(
  emails: DoneEmailRef[],
  options?: { actionId?: CompletionActionId },
): void {
  const entries = emails.map(toEntry);
  if (!entries.length) return;

  // Group by account so the Gmail read-state sync hits the right mailbox.
  const idsByAccount = new Map<string | undefined, string[]>();
  for (const entry of entries) {
    const list = idsByAccount.get(entry.accountId) ?? [];
    list.push(entry.id);
    idsByAccount.set(entry.accountId, list);
  }
  for (const [accountId, ids] of idsByAccount) {
    markEmailsRead(ids, { accountId });
  }

  if (options?.actionId !== "waiting_on_someone") {
    addDismissedIds(entries.map((e) => scopedEmailKey(e.id, e.accountId)));
  }
}

/** Reverses dismissals when a completion undo toast is used. */
export function revertDoneInboxEffects(emails: DoneEmailRef[]): void {
  const entries = emails.map(toEntry);
  if (!entries.length) return;
  removeDismissedIds(
    entries.flatMap((e) =>
      e.accountId ? [scopedEmailKey(e.id, e.accountId), e.id] : [e.id],
    ),
  );
}
