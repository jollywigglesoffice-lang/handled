import type { DraftMemoryStore } from "@/lib/draft-memory/types";

export const EMPTY_DRAFT_MEMORY: DraftMemoryStore = {
  version: 1,
  profiles: [],
  preferredLanguages: [],
  globalHints: [],
};
