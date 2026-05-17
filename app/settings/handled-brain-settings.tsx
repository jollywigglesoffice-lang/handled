"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BRAIN_CATEGORY_LABELS,
  type BrainEntry,
  type BrainEntryCategory,
  type HandledBrain,
  EMPTY_BRAIN,
} from "@/lib/handled-brain/types";
import { loadClientHandledBrain, saveClientHandledBrain } from "@/lib/handled-brain/client-storage";

const CATEGORIES = Object.keys(BRAIN_CATEGORY_LABELS) as BrainEntryCategory[];

function newEntry(category: BrainEntryCategory = "general"): BrainEntry {
  return {
    id: crypto.randomUUID(),
    category,
    title: "",
    content: "",
    updatedAt: Date.now(),
  };
}

export function HandledBrainSettings() {
  const [brain, setBrain] = useState<HandledBrain>(EMPTY_BRAIN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/handled-brain", { credentials: "same-origin" });
      const data = (await res.json()) as { brain?: HandledBrain };
      if (res.ok && data.brain) {
        setBrain(data.brain);
        saveClientHandledBrain(data.brain);
      } else {
        setBrain(loadClientHandledBrain());
      }
    } catch {
      setBrain(loadClientHandledBrain());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    saveClientHandledBrain(brain);
    try {
      const res = await fetch("/api/handled-brain", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brain }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      setMessage(data.message ?? (res.ok ? "Saved." : data.error ?? "Save failed — kept on device."));
    } catch {
      setMessage("Saved on this device.");
    } finally {
      setSaving(false);
    }
  }

  function updateEntry(id: string, patch: Partial<BrainEntry>) {
    setBrain((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e,
      ),
    }));
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading Handled Brain…</p>;
  }

  return (
    <section className="space-y-6 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <div>
        <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
          Handled Brain
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Your private knowledge base. Handled uses this when drafting replies — pricing, policies,
          family details, FAQs, and snippets. Handled never sends without your approval.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-indigo-900">
        <p className="font-medium">Coming soon</p>
        <p className="mt-1 text-xs text-indigo-800">
          Google Calendar, Contacts, Docs, and PDF uploads will connect here.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#0F172A]">Writing style</label>
        <textarea
          value={brain.writingStyle ?? ""}
          rows={2}
          placeholder="Warm and brief. Sign emails with — Aisha."
          onChange={(e) => setBrain((b) => ({ ...b, writingStyle: e.target.value }))}
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-4">
        {brain.entries.map((entry) => (
          <div
            key={entry.id}
            className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
          >
            <div className="flex flex-wrap gap-2">
              <select
                value={entry.category}
                onChange={(e) =>
                  updateEntry(entry.id, { category: e.target.value as BrainEntryCategory })
                }
                className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {BRAIN_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setBrain((b) => ({
                    ...b,
                    entries: b.entries.filter((e) => e.id !== entry.id),
                  }))
                }
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
            <input
              type="text"
              value={entry.title}
              placeholder="Title (e.g. Corporate pricing)"
              onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium"
            />
            <textarea
              value={entry.content}
              rows={4}
              placeholder="Facts Handled can use in replies…"
              onChange={(e) => updateEntry(entry.id, { content: e.target.value })}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm leading-relaxed"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setBrain((b) => ({ ...b, entries: [...b.entries, newEntry()] }))}
        className="text-sm font-medium text-indigo-600 hover:underline"
      >
        + Add knowledge
      </button>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Handled Brain"}
        </button>
      </div>

      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
    </section>
  );
}
