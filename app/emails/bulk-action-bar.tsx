"use client";

import { useEffect, useRef, useState } from "react";
import { useCompletionActions } from "@/app/completion-actions-context";
import { useInboxCategories } from "@/app/inbox-categories-context";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import { inboxCategoryTitle, type InboxAiCategory } from "@/lib/inbox-category-catalog";

type BulkActionBarProps = {
  count: number;
  totalVisible: number;
  locale: "en" | "it";
  onMoveTo: (category: InboxAiCategory) => void;
  onCompleteWith: (actionId: CompletionActionId, actionLabel: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onSelectAllVisible: () => void;
  onClear: () => void;
};

const COPY = {
  en: {
    selected: (n: number) => `${n} selected`,
    moveTo: "Move to",
    doneWith: "Done with this",
    archive: "Archive",
    del: "Delete",
    markRead: "Read",
    markUnread: "Unread",
    selectAll: "Select all",
    clear: "Clear",
  },
  it: {
    selected: (n: number) => `${n} selezionate`,
    moveTo: "Sposta in",
    doneWith: "Fatto con queste",
    archive: "Archivia",
    del: "Elimina",
    markRead: "Letta",
    markUnread: "Da leggere",
    selectAll: "Seleziona tutte",
    clear: "Pulisci",
  },
} as const;

export function BulkActionBar({
  count,
  totalVisible,
  locale,
  onMoveTo,
  onCompleteWith,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onSelectAllVisible,
  onClear,
}: BulkActionBarProps) {
  const { catalog } = useInboxCategories();
  const { catalog: actionCatalog } = useCompletionActions();
  const [moveOpen, setMoveOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const moveRef = useRef<HTMLDivElement | null>(null);
  const doneRef = useRef<HTMLDivElement | null>(null);
  const t = COPY[locale];

  useEffect(() => {
    if (!moveOpen && !doneOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moveRef.current?.contains(target) || doneRef.current?.contains(target)) return;
      setMoveOpen(false);
      setDoneOpen(false);
    };
    window.addEventListener("mousedown", onDocClick);
    return () => window.removeEventListener("mousedown", onDocClick);
  }, [moveOpen, doneOpen]);

  useEffect(() => {
    if (count > 0) {
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
      <div
        className={`pointer-events-auto flex max-w-3xl flex-wrap items-center gap-1.5 rounded-2xl bg-white/95 px-2.5 py-2 shadow-[0_12px_40px_-12px_rgba(151,51,255,0.35)] ring-1 ring-accent/15 backdrop-blur transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <span className="flex items-center gap-2 rounded-xl bg-accent-muted px-3 py-1.5 text-sm font-semibold text-accent">
          <CheckGlyph />
          {t.selected(count)}
        </span>

        <div ref={moveRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setDoneOpen(false);
              setMoveOpen((v) => !v);
            }}
            aria-haspopup="menu"
            aria-expanded={moveOpen}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-[#0F172A] transition hover:bg-accent-muted hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t.moveTo}
            <Chevron />
          </button>
          {moveOpen ? (
            <ActionMenu>
              {catalog.selectorOrder.map((category: InboxAiCategory) => (
                <MenuItem
                  key={category}
                  onClick={() => {
                    setMoveOpen(false);
                    onMoveTo(category);
                  }}
                >
                  {inboxCategoryTitle(category, locale, catalog)}
                </MenuItem>
              ))}
            </ActionMenu>
          ) : null}
        </div>

        <div ref={doneRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setMoveOpen(false);
              setDoneOpen((v) => !v);
            }}
            aria-haspopup="menu"
            aria-expanded={doneOpen}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            {t.doneWith}
            <Chevron light />
          </button>
          {doneOpen ? (
            <ActionMenu align="center">
              {actionCatalog.pickerOrder.map((actionId) => (
                <MenuItem
                  key={actionId}
                  onClick={() => {
                    setDoneOpen(false);
                    onCompleteWith(actionId, actionCatalog.labelFor(actionId, locale));
                  }}
                >
                  <span className="text-emerald-600" aria-hidden>
                    ✓{" "}
                  </span>
                  {actionCatalog.labelFor(actionId, locale)}
                </MenuItem>
              ))}
            </ActionMenu>
          ) : null}
        </div>

        <BarButton onClick={onArchive}>{t.archive}</BarButton>
        <BarButton onClick={onDelete}>{t.del}</BarButton>

        <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />

        <BarButton onClick={onMarkRead}>{t.markRead}</BarButton>
        <BarButton onClick={onMarkUnread}>{t.markUnread}</BarButton>
        {count < totalVisible ? (
          <BarButton onClick={onSelectAllVisible}>{t.selectAll}</BarButton>
        ) : null}

        <button
          type="button"
          onClick={onClear}
          className="ml-auto rounded-xl px-3 py-1.5 text-sm font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
        >
          {t.clear}
        </button>
      </div>
    </div>
  );
}

function ActionMenu({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div
      role="menu"
      className={`absolute bottom-full mb-2 max-h-64 w-56 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-[0_16px_48px_-16px_rgba(15,23,42,0.3)] ${
        align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
      }`}
    >
      {children}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-[#0F172A] transition hover:bg-accent-muted hover:text-accent focus:bg-accent-muted focus:outline-none"
    >
      {children}
    </button>
  );
}

function Chevron({ light }: { light?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-3.5 w-3.5 ${light ? "opacity-90" : "opacity-60"}`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4.5 10.5l3 3 8-8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BarButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-3 py-1.5 text-sm font-medium text-[#475569] transition hover:bg-accent-muted hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {children}
    </button>
  );
}
