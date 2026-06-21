/** Canonical relationship category for a sender. */
export type RelationshipKind =
  | "family"
  | "friends"
  | "school"
  | "healthcare"
  | "vip_client"
  | "client"
  | "team"
  | "billing"
  | "newsletters"
  | "promotions"
  | "marketing"
  | "unknown";

/** User-facing label chip (may differ from kind). */
export type RelationshipLabel =
  | "Family"
  | "School"
  | "VIP"
  | "Healthcare"
  | "Billing"
  | "Marketing"
  | "Team"
  | "Client"
  | "Friends"
  | "Newsletter"
  | "Promotion";

export type RelationshipImportance = "vip" | "important" | "normal" | "ignore";

export type RelationshipSource = "manual" | "detected" | "domain" | "category_rule";

export type SenderRelationship = {
  id: string;
  senderEmail: string;
  senderDomain: string;
  relationshipKind: RelationshipKind;
  importance: RelationshipImportance;
  displayLabel: RelationshipLabel;
  source: RelationshipSource;
  confidence: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

/** Resolved profile used at runtime (manual + detected merge). */
export type SenderRelationshipProfile = {
  kind: RelationshipKind;
  label: RelationshipLabel;
  importance: RelationshipImportance;
  source: RelationshipSource;
  confidence: number;
};
