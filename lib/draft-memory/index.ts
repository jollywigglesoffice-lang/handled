export type {
  CommunicationProfileId,
  DraftMemoryIntegrationDescriptor,
  DraftMemoryIntegrationId,
  DraftMemoryStore,
  LearnFromEditInput,
  LearnedStyleProfile,
  ResolvedDraftStyle,
  ResolveDraftStyleInput,
  StyleDimensions,
} from "@/lib/draft-memory/types";

export {
  resolveDraftStyle,
} from "@/lib/draft-memory/resolve";

export {
  learnFromEdit,
  createEmptyStore,
} from "@/lib/draft-memory/learn-from-edit";

export {
  loadClientDraftMemory,
  saveClientDraftMemory,
  draftMemoryHeaders,
  parseDraftMemoryHeader,
  DRAFT_MEMORY_HEADER,
  draftMemoryStorageKey,
} from "@/lib/draft-memory/client-storage";

export { buildStyleIndicator } from "@/lib/draft-memory/indicators";
export { profileForRelationship, PROFILE_PRESETS } from "@/lib/draft-memory/profiles";
export { analyzeTextStyle, detectMixedLanguage } from "@/lib/draft-memory/analyze-text";
export { listDraftMemoryIntegrations } from "@/lib/draft-memory/integrations";
export { EMPTY_DRAFT_MEMORY } from "@/lib/draft-memory/store-defaults";

export function formatDraftMemoryForPrompt(block: string): string {
  if (!block.trim()) return "";
  return block.trim();
}
