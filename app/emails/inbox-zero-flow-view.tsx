"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CategoryTab } from "@/app/emails/category-tabs";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { InboxZeroEmailPanel } from "@/app/emails/inbox-zero-email-panel";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import { recordEmotionalAction } from "@/lib/emotional-memory";
import { recordStressSkip } from "@/lib/inbox-stress";

type InboxZeroFlowViewProps = {
  messages: GmailCardMessage[];
  locale: "en" | "it";
  readStateMap: ReadStateMap;
  activeCategoryTab: CategoryTab;
  onExit: () => void;
  onArchiveEmail: (message: GmailCardMessage) => void;
  onCategoryChange: (
    id: string,
    category: InboxAiCategory,
    options?: InboxCategoryChangeOptions,
  ) => void;
};

const COPY = {
  en: {
    progress: (done: number, total: number) => `${done} of ${total} cleared`,
    emptyTitle: "Nothing left in this view",
    emptySubtitle: "Switch category tabs or return to Standard inbox — all mail stays visible.",
    exit: "Exit Inbox Zero",
  },
  it: {
    progress: (done: number, total: number) => `${done} di ${total} gestite`,
    emptyTitle: "Niente in questa vista",
    emptySubtitle: "Cambia categoria o torna all'inbox standard — tutta la posta resta visibile.",
    exit: "Esci da Inbox Zero",
  },
} as const;

export function InboxZeroFlowView({
  messages,
  locale,
  readStateMap,
  activeCategoryTab,
  onExit,
  onArchiveEmail,
  onCategoryChange,
}: InboxZeroFlowViewProps) {
  const t = COPY[locale];
  const [focusIndex, setFocusIndex] = useState(0);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());
  const sessionTotalRef = useRef(messages.length);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !skippedIds.has(m.id)),
    [messages, skippedIds],
  );

  useEffect(() => {
    setFocusIndex(0);
    setSkippedIds(new Set());
    sessionTotalRef.current = messages.length;
  }, [activeCategoryTab]);

  useEffect(() => {
    sessionTotalRef.current = Math.max(sessionTotalRef.current, messages.length);
    setFocusIndex((i) => Math.min(i, Math.max(0, visibleMessages.length - 1)));
  }, [messages.length, visibleMessages.length]);

  const safeIndex = Math.min(focusIndex, Math.max(0, visibleMessages.length - 1));
  const current = visibleMessages[safeIndex];
  const cleared = sessionTotalRef.current - visibleMessages.length;

  const advance = useCallback(() => {
    const id = visibleMessages[safeIndex]?.id;
    if (!id) return;
    recordEmotionalAction("skip");
    recordStressSkip();
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [visibleMessages, safeIndex]);

  if (!current) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-lg font-semibold text-gray-900">{t.emptyTitle}</p>
        <p className="mt-2 text-sm text-gray-500">{t.emptySubtitle}</p>
        <button type="button" onClick={onExit} className="btn-primary-sm mt-6">
          {t.exit}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs tabular-nums text-gray-400">
          {t.progress(cleared, sessionTotalRef.current)}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="text-xs font-medium text-accent transition hover:text-accent-hover"
        >
          {t.exit}
        </button>
      </div>

      <InboxZeroEmailPanel
        key={current.id}
        message={current}
        locale={locale}
        readStateMap={readStateMap}
        onAdvance={advance}
        onArchive={onArchiveEmail}
        onCategoryChange={onCategoryChange}
      />
    </div>
  );
}
