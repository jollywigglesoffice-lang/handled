"use client";

import { useState } from "react";
import { useInboxCategories } from "@/app/inbox-categories-context";
import type { CategoryApplyScope } from "@/lib/category-correction";
import {
  inboxCategoryTitle,
  type InboxAiCategory,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";
import { createPersonalCategory } from "@/lib/personal-categories/storage";

export type CategoryCorrectionTarget = {
  id: string;
  sender: string;
  subject: string;
  snippet?: string;
  guessedCategory: InboxAiCategory;
};

type CategoryCorrectionPanelProps = {
  target: CategoryCorrectionTarget;
  compact?: boolean;
  /** Inbox Zero: only this email vs sender — hides similar-subject scope. */
  scopeMode?: "full" | "this_or_sender";
  onApply: (
    chosenCategory: InboxAiCategory,
    scope: CategoryApplyScope,
  ) => void | Promise<void>;
  onDismiss?: () => void;
};

export function CategoryCorrectionPanel({
  target,
  compact,
  scopeMode = "full",
  onApply,
  onDismiss,
}: CategoryCorrectionPanelProps) {
  const [chosen, setChosen] = useState<InboxAiCategory | null>(null);
  const [scope, setScope] = useState<CategoryApplyScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreatedCategory, setJustCreatedCategory] = useState(false);

  const { catalog, personal, savePersonal } = useInboxCategories();
  const guessedLabel = inboxCategoryTitle(target.guessedCategory, "en", catalog);
  const step = chosen === null ? "pick_category" : scope === null ? "pick_scope" : "done";

  async function confirm(scopeValue: CategoryApplyScope) {
    if (!chosen) return;
    setBusy(true);
    try {
      await onApply(chosen, scopeValue);
      setScope(scopeValue);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCategory() {
    setCreateError(null);
    const created = createPersonalCategory(newCategoryName, personal);
    if (!created.ok) {
      setCreateError(created.error);
      return;
    }
    setBusy(true);
    try {
      const saved = await savePersonal([...personal, created.category]);
      if (!saved.ok) {
        setCreateError(saved.error ?? "Could not save category.");
        return;
      }
      setChosen(created.category.id);
      setJustCreatedCategory(true);
      setCreatingCategory(false);
      setNewCategoryName("");
    } finally {
      setBusy(false);
    }
  }

  function resetCategoryPick() {
    setChosen(null);
    setJustCreatedCategory(false);
    setCreatingCategory(false);
    setCreateError(null);
    setNewCategoryName("");
  }

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-accent/20 bg-accent-muted/50 p-4"
          : "rounded-2xl border border-accent/20 bg-gradient-to-br from-[#EEF2FF] to-white p-6 shadow-sm"
      }
    >
      {!compact ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Train Handled
        </p>
      ) : null}

      <h3 className={`font-semibold text-[#0F172A] ${compact ? "text-sm" : "mt-2 text-lg"}`}>
        Best guess: {guessedLabel}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Where should {step === "pick_category" ? "emails like this" : "future emails from this sender"}{" "}
        go?
      </p>
      {!compact ? (
        <p className="mt-1 truncate text-xs text-gray-500">
          {target.sender} — {target.subject}
        </p>
      ) : null}

      {step === "pick_category" ? (
        creatingCategory ? (
          <CreateCategoryInline
            compact={compact}
            value={newCategoryName}
            error={createError}
            busy={busy}
            onChange={(v) => {
              setNewCategoryName(v);
              if (createError) setCreateError(null);
            }}
            onCancel={() => {
              setCreatingCategory(false);
              setCreateError(null);
              setNewCategoryName("");
            }}
            onCreate={() => void handleCreateCategory()}
          />
        ) : (
          <CategoryPickGrid
            catalog={catalog}
            guessed={target.guessedCategory}
            onSelect={(cat) => {
              setJustCreatedCategory(false);
              setChosen(cat);
              if (cat === target.guessedCategory) {
                void confirm("this_email");
              }
            }}
            onStartCreate={() => setCreatingCategory(true)}
          />
        )
      ) : null}

      {step === "pick_scope" && chosen ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-[#0F172A]">
            {justCreatedCategory ? (
              <>
                Use <span className="text-accent">{inboxCategoryTitle(chosen, "en", catalog)}</span> for
                this email — how should Handled apply it?
              </>
            ) : (
              <>
                Move to <span className="text-accent">{inboxCategoryTitle(chosen, "en", catalog)}</span> —
                how should Handled apply this?
              </>
            )}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <ScopeButton
              disabled={busy}
              onClick={() => void confirm("this_email")}
              title="Apply only to this email"
              description={
                justCreatedCategory
                  ? "Sort this message into your new category"
                  : "One-time correction for this message"
              }
            />
            <ScopeButton
              disabled={busy}
              onClick={() => void confirm("sender")}
              title="Always categorize emails from this sender this way"
              description={
                justCreatedCategory
                  ? `Future mail from ${target.sender.split("<")[0].trim() || "this sender"}`
                  : `All mail from ${target.sender.split("<")[0].trim() || "this sender"} — updates your inbox now`
              }
              primary
            />
            {scopeMode === "full" && !justCreatedCategory ? (
              <ScopeButton
                disabled={busy}
                onClick={() => void confirm("similar")}
                title="Similar subject lines"
                description="Match keywords in the subject going forward"
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={resetCategoryPick}
            className="text-xs text-gray-500 underline"
          >
            ← Pick a different category
          </button>
        </div>
      ) : null}

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600"
        >
          Skip for now
        </button>
      ) : null}
    </div>
  );
}

function CategoryPickGrid({
  catalog,
  guessed,
  onSelect,
  onStartCreate,
}: {
  catalog: InboxCategoryCatalog;
  guessed: InboxAiCategory;
  onSelect: (c: InboxAiCategory) => void;
  onStartCreate: () => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {catalog.selectorOrder.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onSelect(cat)}
          className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
            cat === guessed
              ? "border-accent/30 bg-white font-medium text-accent ring-1 ring-accent/20"
              : "border-[#E2E8F0] bg-white text-[#0F172A] hover:border-accent/20 hover:bg-accent-muted/30"
          }`}
        >
          {inboxCategoryTitle(cat, "en", catalog)}
          {cat === guessed ? (
            <span className="ml-1 text-xs text-accent/80">(current guess)</span>
          ) : null}
        </button>
      ))}
      <button
        type="button"
        onClick={onStartCreate}
        className="rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-2.5 text-left text-sm font-medium text-accent transition hover:border-accent/30 hover:bg-accent-muted/30"
      >
        + Create category
      </button>
    </div>
  );
}

function CreateCategoryInline({
  compact,
  value,
  error,
  busy,
  onChange,
  onCancel,
  onCreate,
}: {
  compact?: boolean;
  value: string;
  error: string | null;
  busy: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <div className={`${compact ? "mt-3" : "mt-4"} space-y-2`}>
      <label className="block text-sm font-medium text-[#0F172A]">New category name</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              onCreate();
            }
          }}
          placeholder="e.g. Travel, School, Clients"
          maxLength={48}
          autoFocus
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-gray-400 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
        />
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={onCreate}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create & choose"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="text-xs text-gray-500 underline disabled:opacity-50"
      >
        ← Back to categories
      </button>
    </div>
  );
}

function ScopeButton({
  title,
  description,
  onClick,
  disabled,
  primary,
}: {
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-lg border px-4 py-3 text-left transition disabled:opacity-50 ${
        primary
          ? "border-accent/30 bg-accent text-white hover:bg-accent-hover"
          : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
      }`}
    >
      <span className={`block text-sm font-medium ${primary ? "text-white" : "text-[#0F172A]"}`}>
        {title}
      </span>
      <span className={`mt-0.5 block text-xs ${primary ? "text-white/90" : "text-gray-500"}`}>
        {description}
      </span>
    </button>
  );
}
