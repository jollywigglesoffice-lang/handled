"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inboxCategorySectionTitle, type InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategoryUndoSnapshot } from "@/lib/category-undo/types";

const UNDO_VISIBLE_MS = 5000;

type ActiveUndoToast = {
  snapshot: CategoryUndoSnapshot;
  categoryLabel: string;
};

export function useCategoryUndo(locale: "en" | "it") {
  const [active, setActive] = useState<ActiveUndoToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoHandlerRef = useRef<((snapshot: CategoryUndoSnapshot) => void | Promise<void>) | null>(
    null,
  );

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setActive(null);
  }, []);

  const registerUndoHandler = useCallback(
    (handler: (snapshot: CategoryUndoSnapshot) => void | Promise<void>) => {
      undoHandlerRef.current = handler;
    },
    [],
  );

  const offerCategoryUndo = useCallback(
    (snapshot: CategoryUndoSnapshot, newCategory: InboxAiCategory) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const categoryLabel = inboxCategorySectionTitle(newCategory, locale);
      setActive({ snapshot, categoryLabel });
      timerRef.current = setTimeout(() => {
        setActive(null);
        timerRef.current = null;
      }, UNDO_VISIBLE_MS);
    },
    [locale],
  );

  const performUndo = useCallback(async () => {
    if (!active || !undoHandlerRef.current) return;
    const snapshot = active.snapshot;
    dismiss();
    await undoHandlerRef.current(snapshot);
  }, [active, dismiss]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const movedMessage =
    locale === "it"
      ? `Spostato in ${active?.categoryLabel ?? ""}`
      : `Moved to ${active?.categoryLabel ?? ""}`;

  const undoLabel = locale === "it" ? "Annulla" : "Undo";

  return {
    active,
    movedMessage,
    undoLabel,
    offerCategoryUndo,
    performUndo,
    dismiss,
    registerUndoHandler,
  };
}
