"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CategoryUndoToast } from "@/app/emails/category-undo-toast";
import { useEmailCompletions } from "@/app/email-completions-context";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import { trackEvent } from "@/lib/analytics";

const UNDO_VISIBLE_MS = 8000;

type CompletionToast = {
  emailIds: string[];
  message: string;
  actionId: CompletionActionId;
  locale: "en" | "it";
};

type CompletionWorkflowContextValue = {
  notifyCompleted: (input: {
    emailIds: string[];
    actionId: CompletionActionId;
    actionLabel: string;
    locale: "en" | "it";
    /** When set, shows a detail-page return toast (✓ action / marked completed / returning…). */
    returningTo?: string;
  }) => void;
};

const CompletionWorkflowContext = createContext<CompletionWorkflowContextValue | null>(null);

export function CompletionWorkflowProvider({ children }: { children: React.ReactNode }) {
  const { uncompleteEmails } = useEmailCompletions();
  const [toast, setToast] = useState<CompletionToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const notifyCompleted = useCallback(
    ({
      emailIds,
      actionId,
      actionLabel,
      locale,
      returningTo,
    }: {
      emailIds: string[];
      actionId: CompletionActionId;
      actionLabel: string;
      locale: "en" | "it";
      returningTo?: string;
    }) => {
      if (!emailIds.length) return;

      const n = emailIds.length;
      const message = returningTo
        ? locale === "it"
          ? `✓ ${actionLabel}\nEmail completata\nTorno a ${returningTo}...`
          : `✓ ${actionLabel}\nEmail marked completed\nReturning to ${returningTo}...`
        : locale === "it"
          ? n === 1
            ? `Completata · ${actionLabel}`
            : `${n} email completate · ${actionLabel}`
          : n === 1
            ? `Completed · ${actionLabel}`
            : `${n} emails completed · ${actionLabel}`;

      trackEvent("completed_email", { count: n, action_id: actionId });
      trackEvent("completion_action_selected", { action_id: actionId, count: n });

      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ emailIds, message, actionId, locale });
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, UNDO_VISIBLE_MS);
    },
    [],
  );

  const performUndo = useCallback(async () => {
    if (!toast) return;
    const ids = toast.emailIds;
    dismiss();
    await uncompleteEmails(ids);
    trackEvent("completion_action_undo", { count: ids.length, action_id: toast.actionId });
  }, [toast, dismiss, uncompleteEmails]);

  const value = useMemo(() => ({ notifyCompleted }), [notifyCompleted]);

  const undoLabel = toast ? (toast.locale === "it" ? "Annulla" : "Undo") : "";

  return (
    <CompletionWorkflowContext.Provider value={value}>
      {children}
      {toast ? (
        <CategoryUndoToast
          message={toast.message}
          undoLabel={undoLabel}
          onUndo={() => void performUndo()}
          onDismiss={dismiss}
        />
      ) : null}
    </CompletionWorkflowContext.Provider>
  );
}

export function useCompletionWorkflow(): CompletionWorkflowContextValue {
  const ctx = useContext(CompletionWorkflowContext);
  if (!ctx) {
    return {
      notifyCompleted: () => {},
    };
  }
  return ctx;
}
