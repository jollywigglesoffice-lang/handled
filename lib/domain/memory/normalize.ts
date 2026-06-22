import type { MemoryEngineSnapshot } from "@/lib/memory-engine/types";
import { safeArray } from "@/lib/safe-array";

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
    senderMemory: safeArray(snapshot.senderMemory),
    categoryCorrections: safeArray(snapshot.categoryCorrections),
    categoryPatterns: safeArray(snapshot.categoryPatterns),
    actionMemory: safeArray(snapshot.actionMemory),
  };
}

/** Guard array inputs before .filter/.map/.reduce — memory is optional, never blocking. */
export function safeMemoryRecords<T>(records: T[] | null | undefined): T[] {
  return safeArray(records);
}
