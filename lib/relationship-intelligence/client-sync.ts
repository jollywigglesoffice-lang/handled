import {
  loadClientSenderRelationships,
  saveClientSenderRelationships,
  upsertClientSenderRelationship,
} from "@/lib/relationship-intelligence/client-storage";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
import { relationshipFromPreset } from "@/lib/relationship-intelligence/resolve";

export async function syncSenderRelationshipsFromAccount(): Promise<SenderRelationship[]> {
  if (typeof window === "undefined") return [];

  try {
    const res = await fetch("/api/sender-relationships", { credentials: "same-origin" });
    const data = (await res.json()) as { relationships?: SenderRelationship[] };
    if (res.ok && Array.isArray(data.relationships)) {
      saveClientSenderRelationships(data.relationships);
      return data.relationships;
    }
  } catch {
    // offline
  }
  return loadClientSenderRelationships();
}

export async function assignSenderRelationshipPreset(
  sender: string,
  presetId: string,
): Promise<{ ok: boolean; relationship?: SenderRelationship }> {
  const rel = relationshipFromPreset(presetId, sender);
  if (!rel) return { ok: false };

  upsertClientSenderRelationship(rel);

  try {
    const res = await fetch("/api/sender-relationships", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationship: rel }),
    });
    const data = (await res.json()) as { relationship?: SenderRelationship };
    if (res.ok && data.relationship) {
      upsertClientSenderRelationship(data.relationship);
      window.dispatchEvent(new Event("handled-sender-relationships-changed"));
      return { ok: true, relationship: data.relationship };
    }
  } catch {
    window.dispatchEvent(new Event("handled-sender-relationships-changed"));
    return { ok: false, relationship: rel };
  }

  window.dispatchEvent(new Event("handled-sender-relationships-changed"));
  return { ok: true, relationship: rel };
}
