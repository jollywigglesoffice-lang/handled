"use client";

import { useState } from "react";
import { useCompletionActions } from "@/app/completion-actions-context";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import { trackEvent } from "@/lib/analytics";
import { createPersonalCompletionAction } from "@/lib/completion-actions/storage";

type CompletionActionPickerProps = {
  locale: "en" | "it";
  compact?: boolean;
  busy?: boolean;
  onSelect: (actionId: CompletionActionId, actionLabel: string) => void;
  showCreate?: boolean;
};

const COPY = {
  en: {
    prompt: "What happened because of this email?",
    create: "+ Create action",
    newName: "New action",
    createBtn: "Add",
    back: "← Back",
  },
  it: {
    prompt: "Cosa è successo con questa email?",
    create: "+ Crea azione",
    newName: "Nuova azione",
    createBtn: "Aggiungi",
    back: "← Indietro",
  },
} as const;

export function CompletionActionPicker({
  locale,
  compact,
  busy,
  onSelect,
  showCreate = true,
}: CompletionActionPickerProps) {
  const { catalog, personal, savePersonal } = useCompletionActions();
  const t = COPY[locale];
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  async function handleCreate() {
    setCreateError(null);
    const created = createPersonalCompletionAction(newName, personal);
    if (!created.ok) {
      setCreateError(created.error);
      return;
    }
    setCreateBusy(true);
    try {
      const saved = await savePersonal([...personal, created.action]);
      if (!saved.ok) {
        setCreateError(saved.error ?? "Could not save.");
        return;
      }
      trackEvent("completion_action_custom_created", { action_id: created.action.id });
      onSelect(created.action.id, catalog.labelFor(created.action.id, locale));
    } finally {
      setCreateBusy(false);
    }
  }

  if (creating) {
    return (
      <div className={compact ? "mt-3 space-y-2" : "mt-4 space-y-2"}>
        <p className="text-sm font-medium text-[#0F172A]">{t.newName}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (createError) setCreateError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="e.g. Sent to accountant"
            maxLength={56}
            autoFocus
            disabled={createBusy || busy}
            className="min-w-0 flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={createBusy || busy || !newName.trim()}
            onClick={() => void handleCreate()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {createBusy ? "…" : t.createBtn}
          </button>
        </div>
        {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
        <button
          type="button"
          onClick={() => {
            setCreating(false);
            setNewName("");
            setCreateError(null);
          }}
          className="text-xs text-gray-500 underline"
        >
          {t.back}
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <p className="text-sm font-medium text-[#0F172A]">{t.prompt}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {catalog.pickerOrder.map((actionId) => (
          <button
            key={actionId}
            type="button"
            disabled={busy}
            onClick={() => onSelect(actionId, catalog.labelFor(actionId, locale))}
            className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-left text-sm text-[#0F172A] transition hover:border-accent/20 hover:bg-accent-muted/30 disabled:opacity-50"
          >
            <span className="text-accent" aria-hidden>
              ✓
            </span>
            {catalog.labelFor(actionId, locale)}
          </button>
        ))}
        {showCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={busy}
            className="rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-2.5 text-left text-sm font-medium text-accent hover:border-accent/30 disabled:opacity-50"
          >
            {t.create}
          </button>
        ) : null}
      </div>
    </div>
  );
}
