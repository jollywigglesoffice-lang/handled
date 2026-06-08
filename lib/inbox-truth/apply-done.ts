import type { CompletionActionId } from "@/lib/completion-actions/types";
import { addDismissedIds, removeDismissedIds } from "@/lib/dismissed/client-storage";
import { markEmailsRead } from "@/lib/read-state/gmail-sync";

/**
 * Standard Gmail-trusted side effects after Done / completion is persisted.
 * - Marks read locally and syncs UNREAD removal to Gmail.
 * - Dismisses from the inbox list (except active Waiting On — completion map hides those).
 */
export function applyDoneInboxEffects(
  emailIds: string[],
  options?: { actionId?: CompletionActionId },
): void {
  if (!emailIds.length) return;

  markEmailsRead(emailIds);

  if (options?.actionId !== "waiting_on_someone") {
    addDismissedIds(emailIds);
  }
}

/** Reverses dismissals when a completion undo toast is used. */
export function revertDoneInboxEffects(emailIds: string[]): void {
  if (!emailIds.length) return;
  removeDismissedIds(emailIds);
}
