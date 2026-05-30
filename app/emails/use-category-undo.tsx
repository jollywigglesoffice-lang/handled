"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inboxCategorySectionTitle, type InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategoryUndoSnapshot } from "@/lib/category-undo/types";
import { trackEvent } from "@/lib/analytics";

const UNDO_VISIBLE_MS = 8000;

type ActiveUndoToast =
  | {
      kind: "category";
      snapshot: CategoryUndoSnapshot;
      message: string;
      actionType: string;
    }
  | {
      kind: "action";
      message: string;
      onUndo: () => void | Promise<void>;
      actionType: string;
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

  const arm = useCallback((next: ActiveUndoToast) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(next);
    timerRef.current = setTimeout(() => {
      setActive(null);
      timerRef.current = null;
    }, UNDO_VISIBLE_MS);
  }, []);

  const offerCategoryUndo = useCallback(
    (
      snapshot: CategoryUndoSnapshot,
      newCategory: InboxAiCategory,
      count = 1,
      customMessage?: string,
    ) => {
      const label = inboxCategorySectionTitle(newCategory, locale);
      const message =
        customMessage ??
        (count > 1
          ? locale === "it"
            ? `${count} email spostate in ${label}`
            : `Moved ${count} emails to ${label}`
          : locale === "it"
            ? `Spostato in ${label}`
            : `Moved to ${label}`);
      arm({ kind: "category", snapshot, message, actionType: "move" });
    },
    [locale, arm],
  );

  /** Generic reversible action (archive, delete, …) with a custom undo. */
  const offerActionUndo = useCallback(
    (input: { message: string; actionType: string; onUndo: () => void | Promise<void> }) => {
      arm({
        kind: "action",
        message: input.message,
        actionType: input.actionType,
        onUndo: input.onUndo,
      });
    },
    [arm],
  );

  const performUndo = useCallback(async () => {
    if (!active) return;
    const current = active;
    dismiss();
    trackEvent("bulk_action_undo", { bulk_action_type: current.actionType });
    if (current.kind === "category") {
      await undoHandlerRef.current?.(current.snapshot);
    } else {
      await current.onUndo();
    }
  }, [active, dismiss]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const undoLabel = locale === "it" ? "Annulla" : "Undo";

  return {
    active,
    undoMessage: active?.message ?? "",
    undoLabel,
    offerCategoryUndo,
    offerActionUndo,
    performUndo,
    dismiss,
    registerUndoHandler,
  };
}
