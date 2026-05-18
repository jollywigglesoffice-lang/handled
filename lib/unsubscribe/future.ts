import type { UnsubscribeBulkJob, UnsubscribeCleanupSuggestion } from "@/lib/unsubscribe/types";

/**
 * Placeholder for weekly cleanup / bulk unsubscribe (not wired yet).
 * Call sites can import these types and stub functions without refactoring later.
 */
export function buildCleanupSuggestionsPlaceholder(): UnsubscribeCleanupSuggestion[] {
  return [];
}

export function createBulkUnsubscribeJobPlaceholder(
  suggestionIds: string[],
): UnsubscribeBulkJob {
  return {
    id: `bulk-${Date.now()}`,
    status: "pending",
    suggestionIds,
    createdAt: Date.now(),
  };
}

export function engagementHintPlaceholder(_senderEmail: string): string | null {
  return null;
}
