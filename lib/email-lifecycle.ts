import type { ReadStateMap } from "@/lib/read-state/client-storage";

export type EmailLifecycleState = "unread" | "read" | "completed";

export const LIFECYCLE_LABELS = {
  en: { unread: "Unread", read: "Read", completed: "Completed" },
  it: { unread: "Da leggere", read: "Letta", completed: "Completata" },
} as const;

/**
 * READ ≠ DONE. Completed is Handled-only; read/unread sync with Gmail.
 * Missing read-map entry → treated as read (Gmail default once synced).
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
