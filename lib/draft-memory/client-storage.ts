import type { DraftMemoryStore } from "@/lib/draft-memory/types";
import { EMPTY_DRAFT_MEMORY } from "@/lib/draft-memory/store-defaults";

export const DRAFT_MEMORY_HEADER = "x-handled-draft-memory";

export function draftMemoryStorageKey(userId: string): string {
  return `handled_draft_memory_${userId}`;
}

export function loadClientDraftMemory(userId: string | null): DraftMemoryStore {
  if (typeof window === "undefined" || !userId) return { ...EMPTY_DRAFT_MEMORY };
  try {
    const raw = localStorage.getItem(draftMemoryStorageKey(userId));
    if (!raw) return { ...EMPTY_DRAFT_MEMORY };
    const parsed = JSON.parse(raw) as DraftMemoryStore;
    if (parsed?.version !== 1) return { ...EMPTY_DRAFT_MEMORY };
    return {
      version: 1,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      preferredLanguages: Array.isArray(parsed.preferredLanguages)
        ? parsed.preferredLanguages
        : [],
      globalHints: Array.isArray(parsed.globalHints) ? parsed.globalHints : [],
    };
  } catch {
    return { ...EMPTY_DRAFT_MEMORY };
  }
}

export function saveClientDraftMemory(
  userId: string,
  store: DraftMemoryStore,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(draftMemoryStorageKey(userId), JSON.stringify(store));
  window.dispatchEvent(new Event("handled-draft-memory-changed"));
}

export function draftMemoryHeaders(userId?: string | null): HeadersInit {
  if (typeof window === "undefined" || !userId) return {};
  const store = loadClientDraftMemory(userId);
  if (!store.profiles.length && !store.preferredLanguages.length) return {};
  try {
    return { [DRAFT_MEMORY_HEADER]: JSON.stringify(store) };
  } catch {
    return {};
  }
}

export function parseDraftMemoryHeader(
  header: string | null,
): DraftMemoryStore | null {
  if (!header?.trim()) return null;
  try {
    const parsed = JSON.parse(header) as DraftMemoryStore;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
