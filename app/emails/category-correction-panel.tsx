"use client";

import { useState } from "react";
import { useInboxCategories } from "@/app/inbox-categories-context";
import type { CategoryApplyScope } from "@/lib/category-correction";
import {
  inboxCategoryTitle,
  type InboxAiCategory,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";

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
  onApply: (
    chosenCategory: InboxAiCategory,
    scope: CategoryApplyScope,
  ) => void | Promise<void>;
  onDismiss?: () => void;
};

export function CategoryCorrectionPanel({
  target,
  compact,
  onApply,
  onDismiss,
}: CategoryCorrectionPanelProps) {
  const [chosen, setChosen] = useState<InboxAiCategory | null>(null);
  const [scope, setScope] = useState<CategoryApplyScope | null>(null);
  const [busy, setBusy] = useState(false);

  const { catalog } = useInboxCategories();
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
        <CategoryPickGrid
          catalog={catalog}
          guessed={target.guessedCategory}
          onSelect={(cat) => {
            setChosen(cat);
            if (cat === target.guessedCategory) {
              void confirm("this_email");
            }
          }}
        />
      ) : null}

      {step === "pick_scope" && chosen ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-[#0F172A]">
            Move to <span className="text-accent">{inboxCategoryTitle(chosen, "en", catalog)}</span> — how
            should Handled apply this?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <ScopeButton
              disabled={busy}
              onClick={() => void confirm("this_email")}
              title="Apply only to this email"
              description="One-time correction for this message"
            />
            <ScopeButton
              disabled={busy}
              onClick={() => void confirm("sender")}
              title="Always categorize emails from this sender like this"
              description={`All mail from ${target.sender.split("<")[0].trim() || "this sender"} — updates your inbox now`}
              primary
            />
            <ScopeButton
              disabled={busy}
              onClick={() => void confirm("similar")}
              title="Similar subject lines"
              description="Match keywords in the subject going forward"
            />
          </div>
          <button
            type="button"
            onClick={() => setChosen(null)}
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
}: {
  catalog: InboxCategoryCatalog;
  guessed: InboxAiCategory;
  onSelect: (c: InboxAiCategory) => void;
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
