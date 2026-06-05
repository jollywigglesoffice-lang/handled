"use client";

import { useCallback, useState } from "react";
import { useCompletionActions } from "@/app/completion-actions-context";
import { SYSTEM_COMPLETION_ACTION_META, SYSTEM_COMPLETION_PICKER_ORDER } from "@/lib/completion-actions/builtin";
import { trackEvent } from "@/lib/analytics";
import {
  createPersonalCompletionAction,
  normalizePersonalCompletionActions,
} from "@/lib/completion-actions/storage";
import type { PersonalCompletionAction } from "@/lib/completion-actions/types";

export function CompletionActionsSettings() {
  const { personal, savePersonal } = useCompletionActions();
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const persist = useCallback(
    async (next: PersonalCompletionAction[]) => {
      setBusy(true);
      setMessage("");
      const result = await savePersonal(next);
      setBusy(false);
      if (!result.ok) setMessage(result.error ?? "Could not save.");
      else setMessage("Saved.");
      window.setTimeout(() => setMessage(""), 2500);
    },
    [savePersonal],
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const created = createPersonalCompletionAction(newName, personal);
    if (!created.ok) {
      setMessage(created.error);
      return;
    }
    setNewName("");
    trackEvent("completion_action_custom_created", { action_id: created.action.id });
    await persist([...personal, created.action]);
  }

  async function handleRename(id: string) {
    const trimmed = editLabel.trim();
    if (!trimmed) return;
    const next = personal.map((a) =>
      a.id === id ? { ...a, label: trimmed, updatedAt: Date.now() } : a,
    );
    setEditingId(null);
    await persist(normalizePersonalCompletionActions(next));
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this action? Past completions keep their saved label.")) return;
    await persist(personal.filter((a) => a.id !== id));
  }

  return (
    <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <div>
        <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
          Completion actions
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
          When you tap Done with this, pick what you did — Replied, Saved for reference, or your
          own shortcuts. Handled learns from these over time (suggestions coming later).
        </p>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Built-in (always available)
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SYSTEM_COMPLETION_PICKER_ORDER.map((id) => (
            <li
              key={id}
              className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs font-medium text-gray-700"
            >
              {SYSTEM_COMPLETION_ACTION_META[id].labelEn}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={(e) => void handleAdd(e)} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Sent to accountant, Added to lesson plan"
          maxLength={56}
          className="min-w-[12rem] flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Add action
        </button>
      </form>

      {personal.length > 0 ? (
        <ul className="space-y-2">
          {personal.map((action) => (
            <li
              key={action.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3"
            >
              {editingId === action.id ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="min-w-[8rem] flex-1 rounded-lg border border-[#E2E8F0] px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleRename(action.id)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#0F172A]">{action.label}</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(action.id);
                        setEditLabel(action.label);
                      }}
                      className="text-xs font-medium text-gray-600 hover:text-accent"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(action.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">
          No custom actions yet. Add shortcuts you use often when finishing email.
        </p>
      )}

      {message ? <p className="text-xs text-gray-600">{message}</p> : null}
    </section>
  );
}
