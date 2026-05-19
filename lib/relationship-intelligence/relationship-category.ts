import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { matchSemanticMemory, semanticForcedCategory } from "@/lib/relationship-intelligence/semantic-memory";
import { resolveSenderRelationship } from "@/lib/relationship-intelligence/resolve";
import type {
  SenderRelationship,
  SenderRelationshipProfile,
} from "@/lib/relationship-intelligence/types";

export type RelationshipCategoryResult = {
  category: InboxAiCategory;
  profile: SenderRelationshipProfile;
  source: "relationship_memory" | "semantic_memory";
};

/**
 * Relationship + semantic memory pre-phase (after manual overrides, before sender/keyword rules).
 * Returns forced category when sender is known to be school/family/healthcare/VIP.
 */
export function resolveRelationshipCategory(
  row: GmailInboxRow,
  senderRelationships: SenderRelationship[],
): RelationshipCategoryResult | null {
  const storedProfile = resolveSenderRelationship(row, "needs_attention", senderRelationships);
  const semanticProfile = matchSemanticMemory(row, senderRelationships);

  const profile =
    storedProfile && semanticProfile
      ? storedProfile.confidence >= semanticProfile.confidence
        ? storedProfile
        : semanticProfile
      : storedProfile ?? semanticProfile;

  if (!profile) return null;

  const category = semanticForcedCategory(profile);
  if (!category) return null;

  return {
    category,
    profile,
    source: semanticProfile && profile === semanticProfile ? "semantic_memory" : "relationship_memory",
  };
}
