"use client";

import { useCallback, useState } from "react";
import { useInboxCategories } from "@/app/inbox-categories-context";
import {
  createPersonalCategory,
  normalizePersonalCategoriesList,
} from "@/lib/personal-categories/storage";
import type { PersonalInboxCategory } from "@/lib/personal-categories/types";
import { SYSTEM_INBOX_CATEGORY_VALUES } from "@/lib/inbox-ai-categories";
import {
  inboxCategorySelectorTitle,
  inboxCategoryTitle,
} from "@/lib/inbox-category-catalog";

export function PersonalCategoriesSettings() {
  const { catalog, personal, savePersonal } = useInboxCategories();
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const persist = useCallback(
    async (next: PersonalInboxCategory[]) => {
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
    const created = createPersonalCategory(newName, personal);
    if (!created.ok) {
      setMessage(created.error);
      return;
    }
    setNewName("");
    await persist([...personal, created.category]);
  }

  async function handleRename(id: string) {
    const trimmed = editLabel.trim();
    if (!trimmed) return;
    const next = personal.map((c) =>
      c.id === id
        ? {
            ...c,
            label: trimmed,
            updatedAt: Date.now(),
          }
        : c,
    );
    setEditingId(null);
    await persist(normalizePersonalCategoriesList(next));
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this category? Emails already sorted here stay in your inbox.")) {
      return;
    }
    await persist(personal.filter((c) => c.id !== id));
  }

  return (
    <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-7 shadow-sm sm:p-8">
      <div>
        <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
          Your categories
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
          Add a few labels that match how you think about mail — Travel, School, Clients. They
          appear in your inbox tabs and when you teach Handled where mail should go.
        </p>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Built-in (always available)
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SYSTEM_INBOX_CATEGORY_VALUES.map((id) => (
            <li
              key={id}
              className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs font-medium text-gray-700"
            >
              {inboxCategorySelectorTitle(id, "en", catalog)}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={(e) => void handleAdd(e)} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Travel, School, Receipts"
          maxLength={48}
          className="min-w-[12rem] flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          Add category
        </button>
      </form>

      {personal.length > 0 ? (
        <ul className="space-y-2">
          {personal.map((cat) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3"
            >
              {editingId === cat.id ? (
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
                    onClick={() => void handleRename(cat.id)}
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
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F172A]">{cat.label}</p>
                    <p className="text-xs text-gray-400">
                      {inboxCategoryTitle(cat.id, "en", catalog)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditLabel(cat.label);
                      }}
                      className="text-xs font-medium text-gray-600 hover:text-accent"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(cat.id)}
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
          No personal categories yet. Try Travel or School if those help you scan faster.
        </p>
      )}

      {message ? <p className="text-xs text-gray-600">{message}</p> : null}
    </section>
  );
}
