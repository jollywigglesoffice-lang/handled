import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import { setReadStateForIds, type EmailReadState } from "@/lib/read-state/client-storage";
import { trackEvent } from "@/lib/analytics";

export const SYNC_TOAST_EVENT = "handled-sync-toast";

const MAX_RETRIES = 3;
const BASE_RETRY_MS = 1500;

function emitSyncToast(message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SYNC_TOAST_EVENT, { detail: { message } }));
}

/**
 * Push read/unread state to Gmail (remove/add the UNREAD label). Optimistic:
 * callers update local state first. On failure we retry quietly in the
 * background and only surface a subtle toast once retries are exhausted.
 */
export async function syncReadStateToGmail(
  ids: string[],
  state: EmailReadState,
  attempt = 0,
): Promise<boolean> {
  if (typeof window === "undefined" || ids.length === 0) return true;

  try {
    const res = await fetch("/api/gmail/read-state", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        ...(await protectedApiHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids, state }),
    });

    if (res.ok) {
      trackEvent("gmail_sync_success", { state, count: ids.length });
      return true;
    }
    throw new Error(`status ${res.status}`);
  } catch {
    if (attempt < MAX_RETRIES) {
      const delay = BASE_RETRY_MS * 2 ** attempt;
      window.setTimeout(() => {
        void syncReadStateToGmail(ids, state, attempt + 1);
      }, delay);
      return false;
    }

    trackEvent("gmail_sync_failed", { state, count: ids.length });
    emitSyncToast(
      state === "read"
        ? "Couldn't sync read status to Gmail — will keep trying."
        : "Couldn't sync to Gmail — will keep trying.",
    );
    return false;
  }
}

/** Mark read locally (optimistic) + sync to Gmail in the background. */
export function markEmailsRead(ids: string[]): void {
  if (ids.length === 0) return;
  setReadStateForIds(ids, "read");
  trackEvent("email_marked_read", { count: ids.length });
  void syncReadStateToGmail(ids, "read");
}

/** Mark unread locally (optimistic) + sync to Gmail in the background. */
export function markEmailsUnread(ids: string[]): void {
  if (ids.length === 0) return;
  setReadStateForIds(ids, "unread");
  trackEvent("email_marked_unread", { count: ids.length });
  void syncReadStateToGmail(ids, "unread");
}
