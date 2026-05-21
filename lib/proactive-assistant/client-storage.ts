const DISMISS_KEY = "handled_proactive_dismissed_v1";

export function loadDismissedProactiveIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

export function dismissProactiveSuggestion(id: string): void {
  if (typeof window === "undefined") return;
  const set = loadDismissedProactiveIds();
  set.add(id);
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
}

export function filterDismissedSuggestions<T extends { id: string }>(
  suggestions: T[],
): T[] {
  const dismissed = loadDismissedProactiveIds();
  return suggestions.filter((s) => !dismissed.has(s.id));
}
