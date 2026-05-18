"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BRAIN_CATEGORY_LABELS,
  BRAIN_CATEGORY_ORDER,
  type BrainEntry,
  type BrainEntryCategory,
  type BrainSyncStatus,
  type HandledBrain,
  EMPTY_BRAIN,
} from "@/lib/handled-brain/types";
import { formatBrainLastUpdated, formatRelativeBrainSync } from "@/lib/handled-brain/format-timestamp";
import {
  cacheBrainLocally,
  loadBrainFromAccount,
  registerBrainOnlineSync,
  syncBrainToCloud,
} from "@/lib/handled-brain/brain-sync-client";

function newEntry(category: BrainEntryCategory = "faq"): BrainEntry {
  return {
    id: crypto.randomUUID(),
    category,
    title: "",
    content: "",
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
}

function SyncStatusBar({
  status,
  message,
  lastSyncedAt,
}: {
  status: BrainSyncStatus;
  message: string;
  lastSyncedAt: string | null;
}) {
  const tone =
    status === "saved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : status === "syncing"
        ? "border-indigo-200 bg-indigo-50 text-indigo-900"
        : status === "offline_cached"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : status === "error"
            ? "border-red-200 bg-red-50 text-red-900"
            : "border-[#E2E8F0] bg-[#F8FAFC] text-gray-600";

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      {status === "syncing" ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
          aria-hidden
        />
      ) : null}
      <span>{message}</span>
      {lastSyncedAt && status === "saved" ? (
        <span className="text-xs opacity-80">· {formatRelativeBrainSync(lastSyncedAt)}</span>
      ) : null}
    </div>
  );
}

function BrainEntryCard({
  entry,
  isEditing,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onChange,
}: {
  entry: BrainEntry;
  isEditing: boolean;
  isSaving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<BrainEntry>) => void;
}) {
  if (!isEditing) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-100">
              {BRAIN_CATEGORY_LABELS[entry.category]}
            </span>
            <h3 className="mt-2 text-sm font-semibold text-[#0F172A]">
              {entry.title.trim() || "Untitled"}
            </h3>
            {entry.content.trim() ? (
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-gray-600">
                {entry.content}
              </p>
            ) : (
              <p className="mt-1 text-sm italic text-gray-400">No content yet</p>
            )}
            <p className="mt-2 text-[10px] text-gray-400">
              Last updated {formatBrainLastUpdated(entry.updatedAt)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F1F5F9]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 ring-1 ring-indigo-100">
      <select
        value={entry.category}
        onChange={(e) => onChange({ category: e.target.value as BrainEntryCategory })}
        className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm"
      >
        {BRAIN_CATEGORY_ORDER.map((c) => (
          <option key={c} value={c}>
            {BRAIN_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={entry.title}
        placeholder="Title (e.g. Corporate pricing)"
        onChange={(e) => onChange({ title: e.target.value })}
        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium"
      />
      <textarea
        value={entry.content}
        rows={5}
        placeholder="Facts Handled can use in replies…"
        onChange={(e) => onChange({ content: e.target.value })}
        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm leading-relaxed"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={onSaveEdit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save entry"}
        </button>
        <button
          type="button"
          onClick={onCancelEdit}
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-[#F8FAFC]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function HandledBrainSettings() {
  const [brain, setBrain] = useState<HandledBrain>(EMPTY_BRAIN);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<BrainSyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEntry, setDraftEntry] = useState<BrainEntry | null>(null);
  const brainRef = useRef(brain);
  const syncTimerRef = useRef<number | null>(null);
  const skipAutoSyncRef = useRef(true);

  brainRef.current = brain;

  const applySyncState = useCallback(
    (state: { status: BrainSyncStatus; message: string; lastSyncedAt: string | null }) => {
      setSyncStatus(state.status);
      setSyncMessage(state.message);
      if (state.lastSyncedAt) setLastSyncedAt(state.lastSyncedAt);
    },
    [],
  );

  const syncNow = useCallback(
    async (nextBrain?: HandledBrain) => {
      const payload = nextBrain ?? brainRef.current;
      setSyncStatus("syncing");
      setSyncMessage("Syncing to your Handled account…");
      const result = await syncBrainToCloud(payload);
      applySyncState(result);
      return result;
    },
    [applySyncState],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setSyncStatus("syncing");
    setSyncMessage("Loading from your account…");
    const { brain: loaded, fromCache } = await loadBrainFromAccount();
    setBrain(loaded);
    cacheBrainLocally(loaded);
    setSyncStatus(fromCache ? "offline_cached" : "saved");
    setSyncMessage(
      fromCache
        ? "Showing cached knowledge — will sync when online."
        : "Synced to your Handled account",
    );
    if (!fromCache) setLastSyncedAt(new Date().toISOString());
    setLoading(false);
    skipAutoSyncRef.current = true;
    window.setTimeout(() => {
      skipAutoSyncRef.current = false;
    }, 500);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => registerBrainOnlineSync(applySyncState), [applySyncState]);

  useEffect(() => {
    if (skipAutoSyncRef.current) return;
    if (editingId) return;

    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void syncNow(brainRef.current);
    }, 1200);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [brain, editingId, syncNow]);

  function startEdit(entry: BrainEntry) {
    setEditingId(entry.id);
    setDraftEntry({ ...entry });
    skipAutoSyncRef.current = true;
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftEntry(null);
    skipAutoSyncRef.current = false;
  }

  async function saveEdit() {
    if (!draftEntry || !editingId) return;
    const next: HandledBrain = {
      ...brain,
      entries: brain.entries.map((e) =>
        e.id === editingId ? { ...draftEntry, updatedAt: Date.now() } : e,
      ),
    };
    setBrain(next);
    setEditingId(null);
    setDraftEntry(null);
    skipAutoSyncRef.current = false;
    await syncNow(next);
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this knowledge entry?")) return;
    const next: HandledBrain = {
      ...brain,
      entries: brain.entries.filter((e) => e.id !== id),
    };
    setBrain(next);
    if (editingId === id) cancelEdit();
    await syncNow(next);
  }

  function addEntry() {
    const entry = newEntry("faq");
    setBrain((b) => ({ ...b, entries: [...b.entries, entry] }));
    startEdit(entry);
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
        <p className="text-sm text-gray-500">Loading Handled Brain from your account…</p>
        <div className="h-2 w-32 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <div>
        <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
          Handled Brain
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Your private knowledge base, synced to your Handled account. Handled uses this when
          drafting replies on any device. Handled never sends without your approval.
        </p>
      </div>

      <SyncStatusBar status={syncStatus} message={syncMessage} lastSyncedAt={lastSyncedAt} />

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-indigo-900">
        <p className="font-medium">Coming soon</p>
        <p className="mt-1 text-xs text-indigo-800">
          Google Calendar, Contacts, Docs, and Drive will plug into the same knowledge pipeline.
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

      {brain.entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-10 text-center">
          <p className="text-sm font-medium text-[#0F172A]">No knowledge yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Add pricing, FAQs, policies, or snippets Handled can use in replies.
          </p>
          <button
            type="button"
            onClick={addEntry}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add your first entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {brain.entries.map((entry) => (
            <BrainEntryCard
              key={entry.id}
              entry={editingId === entry.id && draftEntry ? draftEntry : entry}
              isEditing={editingId === entry.id}
              isSaving={syncStatus === "syncing"}
              onStartEdit={() => startEdit(entry)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => void saveEdit()}
              onDelete={() => void deleteEntry(entry.id)}
              onChange={(patch) => setDraftEntry((d) => (d ? { ...d, ...patch } : d))}
            />
          ))}
        </div>
      )}

      {brain.entries.length > 0 ? (
        <button
          type="button"
          onClick={addEntry}
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          + Add knowledge
        </button>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t border-[#E2E8F0] pt-4">
        <button
          type="button"
          disabled={syncStatus === "syncing"}
          onClick={() => void syncNow()}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {syncStatus === "syncing" ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </section>
  );
}
