import {
  isSenderRelationshipsTableMissingError,
  parseImportance,
  parseRelationshipKind,
  SETUP_SQL,
} from "@/lib/relationship-intelligence/storage";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
import { kindToDisplayLabel } from "@/lib/relationship-intelligence/labels";
import type { RelationshipLabel } from "@/lib/relationship-intelligence/types";

export { SETUP_SQL };

async function getSupabaseAdmin() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

function rowToRelationship(row: {
  id: string;
  sender_email: string;
  sender_domain: string;
  relationship_kind: string;
  importance: string;
  display_label: string | null;
  source: string;
  confidence: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}): SenderRelationship {
  const kind = parseRelationshipKind(row.relationship_kind);
  return {
    id: row.id,
    senderEmail: row.sender_email,
    senderDomain: row.sender_domain,
    relationshipKind: kind,
    importance: parseImportance(row.importance),
    displayLabel: (row.display_label as RelationshipLabel) || kindToDisplayLabel(kind),
    source: row.source as SenderRelationship["source"],
    confidence: row.confidence,
    enabled: row.enabled,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function loadSenderRelationshipsForUser(
  userId: string,
): Promise<SenderRelationship[]> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sender_relationships")
    .select(
      "id, sender_email, sender_domain, relationship_kind, importance, display_label, source, confidence, enabled, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isSenderRelationshipsTableMissingError(error.message)) return [];
    console.warn("[sender-relationships] load failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) =>
    rowToRelationship(row as Parameters<typeof rowToRelationship>[0]),
  );
}

export async function saveSenderRelationshipsForUser(
  userId: string,
  relationships: SenderRelationship[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { syncPublicUserFromAuth } = await import("@/lib/sync-public-user");
  const sync = await syncPublicUserFromAuth(userId);
  if (sync.error) return { ok: false, error: sync.error };

  const supabase = await getSupabaseAdmin();
  const now = new Date().toISOString();

  for (const rel of relationships) {
    const { error } = await supabase.from("sender_relationships").upsert(
      {
        id: rel.id.startsWith("rel-") ? undefined : rel.id,
        user_id: userId,
        sender_email: rel.senderEmail,
        sender_domain: rel.senderDomain,
        relationship_kind: rel.relationshipKind,
        importance: rel.importance,
        display_label: rel.displayLabel,
        source: rel.source,
        confidence: rel.confidence,
        enabled: rel.enabled,
        updated_at: now,
      },
      { onConflict: "user_id,sender_email" },
    );
    if (error) {
      if (isSenderRelationshipsTableMissingError(error.message)) {
        return {
          ok: false,
          error: "Run supabase/sql/sender_relationships.sql in Supabase SQL Editor.",
        };
      }
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

export async function upsertSenderRelationshipForUser(
  userId: string,
  rel: SenderRelationship,
): Promise<{ ok: true; relationship: SenderRelationship } | { ok: false; error: string }> {
  const existing = await loadSenderRelationshipsForUser(userId);
  const merged = [
    rel,
    ...existing.filter(
      (r) =>
        r.senderEmail !== rel.senderEmail &&
        (r.senderDomain !== rel.senderDomain || !rel.senderDomain),
    ),
  ];
  const saved = await saveSenderRelationshipsForUser(userId, merged);
  if (!saved.ok) return saved;
  return { ok: true, relationship: rel };
}
