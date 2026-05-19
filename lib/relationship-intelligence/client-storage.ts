import {
  parseSenderRelationshipsJson,
  SENDER_RELATIONSHIPS_HEADER,
  SENDER_RELATIONSHIPS_STORAGE_KEY,
} from "@/lib/relationship-intelligence/storage";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";

export function loadClientSenderRelationships(): SenderRelationship[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SENDER_RELATIONSHIPS_STORAGE_KEY);
    if (!raw) return [];
    return parseSenderRelationshipsJson(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveClientSenderRelationships(rels: SenderRelationship[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SENDER_RELATIONSHIPS_STORAGE_KEY, JSON.stringify(rels));
}

export function upsertClientSenderRelationship(rel: SenderRelationship): void {
  const list = loadClientSenderRelationships().filter(
    (r) =>
      r.senderEmail !== rel.senderEmail &&
      (r.senderDomain !== rel.senderDomain || !rel.senderDomain),
  );
  saveClientSenderRelationships([rel, ...list]);
}

export function senderRelationshipsHeaders(): HeadersInit {
  const rels = loadClientSenderRelationships();
  if (rels.length === 0) return {};
  return {
    [SENDER_RELATIONSHIPS_HEADER]: JSON.stringify(rels),
  };
}

export function parseSenderRelationshipsHeader(raw: string | null): SenderRelationship[] {
  if (!raw?.trim()) return [];
  try {
    return parseSenderRelationshipsJson(JSON.parse(raw));
  } catch {
    return [];
  }
}
