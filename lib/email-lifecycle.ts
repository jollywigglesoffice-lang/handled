import type { ReadStateMap } from "@/lib/read-state/client-storage";

export type EmailLifecycleState = "unread" | "read" | "completed";

export const LIFECYCLE_LABELS = {
  en: { unread: "Unread", read: "Read", completed: "Completed" },
  it: { unread: "Da leggere", read: "Letta", completed: "Completata" },
} as const;

/**
 * READ ≠ DONE. Completed is Handled-only; read/unread sync with Gmail.
 * Fetched messages import UNREAD from Gmail labelIds on inbox load.
 * Missing read-map entry → treated as read (not yet synced or outside loaded slice).
 */
export function resolveEmailLifecycle(
  emailId: string,
  readMap: ReadStateMap,
  isCompleted: boolean,
): EmailLifecycleState {
  if (isCompleted) return "completed";
  if (readMap[emailId] === "unread") return "unread";
  return "read";
}
