export const DISMISSED_KEY = "handled_dismissed_v1";
export const DISMISSED_EVENT = "handled-dismissed-changed";

/**
 * Locally archived/deleted message ids. Mirrors the app's local-first pattern
 * (read-state, handled ids) so the inbox stays calm after a refresh without a
 * server round-trip. Fully reversible via the undo toast.
 */
export function loadDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function save(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
    window.dispatchEvent(new Event(DISMISSED_EVENT));
  } catch {
    // quota — ignore
  }
}

export function addDismissedIds(ids: string[]): void {
  if (!ids.length) return;
  const next = loadDismissedIds();
  for (const id of ids) next.add(id);
  save(next);
}

export function removeDismissedIds(ids: string[]): void {
  if (!ids.length) return;
  const next = loadDismissedIds();
  for (const id of ids) next.delete(id);
  save(next);
}
