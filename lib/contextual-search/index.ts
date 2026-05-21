export type {
  ContextualSearchAnswer,
  ContextualSearchHit,
  ContextualSearchIntegrationDescriptor,
  ContextualSearchIntegrationId,
  ContextualSearchMessage,
  ContextualSearchResult,
  MemoryRecord,
  MemorySource,
  SearchIntent,
  SearchMemoryInput,
  SmartSearchFilter,
} from "@/lib/contextual-search/types";

export {
  searchContextualMemory,
  formatContextualSearchForPrompt,
  SMART_SEARCH_FILTERS,
} from "@/lib/contextual-search/search";

export { parseSearchQuery, type ParsedSearchQuery } from "@/lib/contextual-search/parse-query";
export { buildSearchMemoryIndex } from "@/lib/contextual-search/build-index";
export { buildSearchAnswer } from "@/lib/contextual-search/answer";
export { listContextualSearchIntegrations } from "@/lib/contextual-search/integrations";
