import type { RelationshipKind, RelationshipLabel } from "@/lib/relationship-intelligence/types";

export const RELATIONSHIP_KIND_OPTIONS: RelationshipKind[] = [
  "family",
  "friends",
  "school",
  "healthcare",
  "vip_client",
  "client",
  "team",
  "billing",
  "newsletters",
  "promotions",
  "marketing",
  "unknown",
];

export const MANUAL_RELATIONSHIP_PRESETS: Array<{
  id: string;
  kind: RelationshipKind;
  importance: "vip" | "important" | "normal" | "ignore";
  label: RelationshipLabel;
}> = [
  { id: "vip", kind: "vip_client", importance: "vip", label: "VIP" },
  { id: "family", kind: "family", importance: "important", label: "Family" },
  { id: "school", kind: "school", importance: "important", label: "School" },
  { id: "important", kind: "unknown", importance: "important", label: "Client" },
  { id: "ignore", kind: "unknown", importance: "ignore", label: "Marketing" },
  { id: "promotions", kind: "promotions", importance: "ignore", label: "Promotion" },
];

export function kindToDisplayLabel(kind: RelationshipKind): RelationshipLabel {
  const map: Record<RelationshipKind, RelationshipLabel> = {
    family: "Family",
    friends: "Friends",
    school: "School",
    healthcare: "Healthcare",
    vip_client: "VIP",
    client: "Client",
    team: "Team",
    billing: "Billing",
    newsletters: "Newsletter",
    promotions: "Promotion",
    marketing: "Marketing",
    unknown: "Client",
  };
  return map[kind];
}

export function relationshipLabelTone(
  kind: RelationshipKind,
  importance: string,
): "warm" | "professional" | "calm" | "muted" {
  if (kind === "family" || kind === "friends") return "warm";
  if (kind === "vip_client" || kind === "client" || kind === "team") return "professional";
  if (kind === "newsletters" || kind === "promotions" || kind === "marketing") return "muted";
  if (importance === "ignore") return "muted";
  return "calm";
}
