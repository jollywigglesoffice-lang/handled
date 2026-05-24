"use client";

import { useCallback, useEffect, useState } from "react";
import { kindToDisplayLabel } from "@/lib/relationship-intelligence/labels";
import {
  loadClientSenderRelationships,
  saveClientSenderRelationships,
} from "@/lib/relationship-intelligence/client-storage";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
import { useUiCopy } from "@/app/use-ui-copy";

export function SenderRelationshipsSettings({ embedded = false }: { embedded?: boolean }) {
  const ui = useUiCopy();
  const [relationships, setRelationships] = useState<SenderRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sender-relationships", { credentials: "same-origin" });
      const data = (await res.json()) as { relationships?: SenderRelationship[] };
      if (res.ok && data.relationships) {
        setRelationships(data.relationships);
        saveClientSenderRelationships(data.relationships);
      } else {
        setRelationships(loadClientSenderRelationships());
      }
    } catch {
      setRelationships(loadClientSenderRelationships());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    const next = relationships.filter((r) => r.id !== id);
    setRelationships(next);
    saveClientSenderRelationships(next);
    setMessage("Saving…");
    try {
      const res = await fetch("/api/sender-relationships", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationships: next }),
      });
      if (res.ok) {
        setMessage("Synced");
        window.dispatchEvent(new Event("handled-sender-relationships-changed"));
        window.dispatchEvent(new Event("handled-inbox-refresh-requested"));
      }
    } catch {
      setMessage("Saved locally");
    }
  }

  return (
    <section className={embedded ? "space-y-3" : "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"}>
      {!embedded ? (
        <>
          <h2 className="text-lg font-semibold text-gray-900">{ui.relationship.settingsTitle}</h2>
          <p className="mt-2 text-sm text-gray-500">{ui.relationship.settingsSubtitle}</p>
        </>
      ) : null}
      {!embedded ? (
        <p className="mt-1 text-xs text-gray-400">
          Contacts and CRM sync coming later — relationships already shape triage, replies, and
          follow-ups.
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-gray-400">Loading…</p>
      ) : relationships.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
          {ui.relationship.emptySettings}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {relationships.map((rel) => (
            <li
              key={rel.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {rel.senderEmail || rel.senderDomain}
                </p>
                <p className="text-xs text-gray-500">
                  {rel.displayLabel || kindToDisplayLabel(rel.relationshipKind)}
                  {rel.importance !== "normal" ? ` · ${rel.importance}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(rel.id)}
                className="text-xs text-gray-500 hover:text-rose-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {message ? <p className="mt-3 text-xs text-emerald-700">{message}</p> : null}
    </section>
  );
}
