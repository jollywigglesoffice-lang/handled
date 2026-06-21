import type { MemoryEngineSnapshot } from "@/lib/memory-engine/types";

export function emptyMemoryEngineSnapshot(): MemoryEngineSnapshot {
  return {
    senderMemory: [],
    categoryCorrections: [],
    categoryPatterns: [],
    actionMemory: [],
  };
}

/** Coerce partial/corrupted memory payloads into a safe snapshot shape. */
export function normalizeMemoryEngineSnapshot(
  snapshot: Partial<MemoryEngineSnapshot> | null | undefined,
): MemoryEngineSnapshot {
  if (!snapshot || typeof snapshot !== "object") {
    return emptyMemoryEngineSnapshot();
  }

  return {
    senderMemory: Array.isArray(snapshot.senderMemory) ? snapshot.senderMemory : [],
    categoryCorrections: Array.isArray(snapshot.categoryCorrections)
      ? snapshot.categoryCorrections
      : [],
    categoryPatterns: Array.isArray(snapshot.categoryPatterns) ? snapshot.categoryPatterns : [],
    actionMemory: Array.isArray(snapshot.actionMemory) ? snapshot.actionMemory : [],
  };
}

/** Guard array inputs before .filter/.map/.reduce — memory is optional, never blocking. */
export function safeMemoryRecords<T>(records: T[] | null | undefined): T[] {
  return Array.isArray(records) ? records : [];
}
