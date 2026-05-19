import type {
  RelationshipImportance,
  RelationshipKind,
  RelationshipLabel,
  RelationshipSource,
  SenderRelationship,
} from "@/lib/relationship-intelligence/types";
import { kindToDisplayLabel } from "@/lib/relationship-intelligence/labels";

export const SENDER_RELATIONSHIPS_STORAGE_KEY = "handled_sender_relationships_v1";
export const SENDER_RELATIONSHIPS_HEADER = "x-handled-sender-relationships";
export const SETUP_SQL = "supabase/sql/sender_relationships.sql";

const KINDS: RelationshipKind[] = [
  "family",
  "friends",
  "school",
  "healthcare",
  "vip_client",
  "client",
  "team",
  "billing",
  "newsletter",
  "promotion",
  "marketing",
  "unknown",
];

const IMPORTANCE: RelationshipImportance[] = ["vip", "important", "normal", "ignore"];

export function parseRelationshipKind(raw: string): RelationshipKind {
  const k = raw?.trim().toLowerCase();
  return (KINDS as readonly string[]).includes(k) ? (k as RelationshipKind) : "unknown";
}

export function parseImportance(raw: string): RelationshipImportance {
  const k = raw?.trim().toLowerCase();
  return (IMPORTANCE as readonly string[]).includes(k)
    ? (k as RelationshipImportance)
    : "normal";
}

export function isSenderRelationshipsTableMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("sender_relationships") &&
    (m.includes("does not exist") || m.includes("schema cache"))
  );
}

export function parseSenderRelationshipsJson(raw: unknown): SenderRelationship[] {
  if (!Array.isArray(raw)) return [];
  const out: SenderRelationship[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const senderEmail =
      typeof row.senderEmail === "string" ? row.senderEmail.trim().toLowerCase() : "";
    const kind = parseRelationshipKind(
      typeof row.relationshipKind === "string" ? row.relationshipKind : "unknown",
    );
    const importance = parseImportance(
      typeof row.importance === "string" ? row.importance : "normal",
    );
    const displayLabel =
      typeof row.displayLabel === "string"
        ? (row.displayLabel as RelationshipLabel)
        : kindToDisplayLabel(kind);
    const id = typeof row.id === "string" ? row.id : `rel-${Date.now()}`;
    const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
    out.push({
      id,
      senderEmail,
      senderDomain: typeof row.senderDomain === "string" ? row.senderDomain : "",
      relationshipKind: kind,
      importance,
      displayLabel,
      source: (typeof row.source === "string" ? row.source : "manual") as RelationshipSource,
      confidence: typeof row.confidence === "number" ? row.confidence : 1,
      enabled: row.enabled !== false,
      createdAt,
      updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : createdAt,
    });
  }
  return out;
}
