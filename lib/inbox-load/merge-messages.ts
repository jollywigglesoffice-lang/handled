/**
 * Merge a refresh slice (newest N) into the existing inbox without dropping
 * older messages the user already loaded.
 */
export function mergeInboxRefreshMessages<T extends { id: string; internalDateMs?: number }>(
  existing: T[],
  fresh: T[],
): T[] {
  if (!existing.length) return fresh;
  if (!fresh.length) return existing;

  const freshIds = new Set(fresh.map((m) => m.id));
  const kept = existing.filter((m) => !freshIds.has(m.id));
  const merged = [...fresh, ...kept];

  merged.sort((a, b) => (b.internalDateMs ?? 0) - (a.internalDateMs ?? 0));
  return merged;
}
