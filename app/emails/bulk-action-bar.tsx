"use client";

import { useEffect, useRef, useState } from "react";
import {
  CATEGORY_OPTIONS,
} from "@/lib/category-correction";
import {
  inboxCategorySectionTitle,
  type InboxAiCategory,
} from "@/lib/inbox-ai-categories";

type BulkActionBarProps = {
  count: number;
  totalVisible: number;
  locale: "en" | "it";
  onMoveTo: (category: InboxAiCategory) => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onSelectAllVisible: () => void;
  onClear: () => void;
};

const COPY = {
  en: {
    selected: (n: number) => `${n} selected`,
    moveTo: "Move to",
    markRead: "Mark read",
    markUnread: "Mark unread",
    selectAll: "Select all visible",
    clear: "Clear",
  },
  it: {
    selected: (n: number) => `${n} selezionate`,
    moveTo: "Sposta in",
    markRead: "Segna come letta",
    markUnread: "Segna come da leggere",
    selectAll: "Seleziona tutte",
    clear: "Annulla selezione",
  },
} as const;

export function BulkActionBar({
  count,
  totalVisible,
  locale,
  onMoveTo,
  onMarkRead,
  onMarkUnread,
  onSelectAllVisible,
  onClear,
}: BulkActionBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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

  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-accent/20 bg-white/95 px-3 py-2.5 shadow-lg shadow-accent/10 ring-1 ring-accent/15 backdrop-blur">
        <span className="flex items-center gap-2 rounded-lg bg-accent-muted px-3 py-1.5 text-sm font-semibold text-accent">
          <span
            aria-hidden
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#9733ff] px-1.5 text-xs font-bold text-white"
          >
            {count}
          </span>
          {t.selected(count)}
        </span>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 rounded-lg bg-[#9733ff] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9733ff] focus-visible:ring-offset-2"
          >
            {t.moveTo}
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
            </svg>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
            >
              {CATEGORY_OPTIONS.map((category: InboxAiCategory) => (
                <button
                  key={category}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onMoveTo(category);
                  }}
                  className="flex w-full items-center px-4 py-2.5 text-left text-sm text-[#0F172A] transition hover:bg-accent-muted hover:text-accent focus:bg-accent-muted focus:text-accent focus:outline-none"
                >
                  {inboxCategorySectionTitle(category, locale)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />

        <BarButton onClick={onMarkRead}>{t.markRead}</BarButton>
        <BarButton onClick={onMarkUnread}>{t.markUnread}</BarButton>
        {count < totalVisible ? (
          <BarButton onClick={onSelectAllVisible}>{t.selectAll}</BarButton>
        ) : null}

        <button
          type="button"
          onClick={onClear}
          className="ml-auto rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
        >
          {t.clear}
        </button>
      </div>
    </div>
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
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-[#0F172A] transition hover:border-accent/30 hover:bg-accent-muted/50 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9733ff]"
    >
      {children}
    </button>
  );
}
