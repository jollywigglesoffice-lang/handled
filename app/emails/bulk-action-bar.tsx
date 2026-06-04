"use client";

import { useEffect, useRef, useState } from "react";
import { useInboxCategories } from "@/app/inbox-categories-context";
import { inboxCategoryTitle, type InboxAiCategory } from "@/lib/inbox-category-catalog";

type BulkActionBarProps = {
  count: number;
  totalVisible: number;
  locale: "en" | "it";
  onMoveTo: (category: InboxAiCategory) => void;
  onMarkHandled: () => void;
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
    handled: "Handled",
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
    handled: "Fatto",
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
  onMarkHandled,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onSelectAllVisible,
  onClear,
}: BulkActionBarProps) {
  const { catalog } = useInboxCategories();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const t = COPY[locale];

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onDocClick);
    return () => window.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  // Soft entrance once the bar appears.
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

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-[#0F172A] transition hover:bg-accent-muted hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t.moveTo}
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 opacity-60" fill="currentColor" aria-hidden>
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
            </svg>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-2xl border border-gray-100 bg-white p-1 shadow-[0_16px_48px_-16px_rgba(15,23,42,0.3)]"
            >
              {catalog.selectorOrder.map((category: InboxAiCategory) => (
                <button
                  key={category}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onMoveTo(category);
                  }}
                  className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-[#0F172A] transition hover:bg-accent-muted hover:text-accent focus:bg-accent-muted focus:text-accent focus:outline-none"
                >
                  {inboxCategoryTitle(category, locale, catalog)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <BarButton onClick={onMarkHandled} primary>
          {t.handled}
        </BarButton>
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
  primary = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl bg-[#9733ff] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9733ff] focus-visible:ring-offset-2"
      >
        {children}
      </button>
    );
  }
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
