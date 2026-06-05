"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompletionWorkflow } from "@/app/completion-workflow-context";
import { useEmailCompletions } from "@/app/email-completions-context";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import { resolveEmailLifecycle, type EmailLifecycleState } from "@/lib/email-lifecycle";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  loadReadStateMap,
  READ_STATE_EVENT,
  type ReadStateMap,
} from "@/lib/read-state/client-storage";
import { markEmailsRead, markEmailsUnread } from "@/lib/read-state/gmail-sync";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";

export const EMAIL_STATUS_COPY = {
  en: {
    markRead: "Mark read",
    markUnread: "Mark unread",
    doneWith: "Done with this",
    undo: "Undo",
    changeCategory: "Change category",
    setRelationship: "Set relationship",
    completedAs: (label: string) => `Completed · ${label}`,
    undone: "Returned to inbox",
  },
  it: {
    markRead: "Segna letta",
    markUnread: "Segna da leggere",
    doneWith: "Fatto con questa",
    undo: "Annulla",
    changeCategory: "Cambia categoria",
    setRelationship: "Assegna relazione",
    completedAs: (label: string) => `Completata · ${label}`,
    undone: "Ripristinata in inbox",
  },
} as const;

export type EmailStatusActionsInput = {
  emailId: string;
  sender: string;
  subject: string;
  snippet?: string;
  category: InboxAiCategory;
  locale: "en" | "it";
  readStateMap?: ReadStateMap;
  onCompleted?: (result: { actionId: CompletionActionId; actionLabel: string }) => void;
};

export function useEmailStatusActions({
  emailId,
  sender,
  subject,
  snippet,
  category,
  locale,
  readStateMap: readStateMapProp,
  onCompleted,
}: EmailStatusActionsInput) {
  const t = EMAIL_STATUS_COPY[locale];
  const { notifyCompleted } = useCompletionWorkflow();
  const { isCompleted, getCompletion, completeEmails, uncompleteEmails } =
    useEmailCompletions();
  const [readMap, setReadMap] = useState<ReadStateMap>(() =>
    readStateMapProp ?? (typeof window !== "undefined" ? loadReadStateMap() : {}),
  );
  const [showDonePicker, setShowDonePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (readStateMapProp) {
      setReadMap(readStateMapProp);
      return;
    }
    const sync = () => setReadMap(loadReadStateMap());
    sync();
    window.addEventListener(READ_STATE_EVENT, sync);
    return () => window.removeEventListener(READ_STATE_EVENT, sync);
  }, [readStateMapProp]);

  const completed = isCompleted(emailId);
  const lifecycle = resolveEmailLifecycle(emailId, readMap, completed);
  const completion = getCompletion(emailId);

  const showFeedback = useCallback((msg: string, ms = 4000) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), ms);
  }, []);

  const handleMarkRead = useCallback(() => {
    markEmailsRead([emailId]);
    setReadMap((prev) => ({ ...prev, [emailId]: "read" }));
  }, [emailId]);

  const handleMarkUnread = useCallback(() => {
    markEmailsUnread([emailId]);
    setReadMap((prev) => ({ ...prev, [emailId]: "unread" }));
  }, [emailId]);

  const handleComplete = useCallback(
    async (actionId: CompletionActionId, actionLabel: string) => {
      setBusy(true);
      try {
        await completeEmails([
          {
            emailId,
            actionId,
            actionLabel,
            sender,
            subject,
            snippet,
            category,
          },
        ]);
        setShowDonePicker(false);
        if (!onCompleted) {
          notifyCompleted({ emailIds: [emailId], actionId, actionLabel, locale });
        }
        onCompleted?.({ actionId, actionLabel });
      } finally {
        setBusy(false);
      }
    },
    [emailId, sender, subject, snippet, category, completeEmails, notifyCompleted, locale, onCompleted],
  );

  const handleUndo = useCallback(async () => {
    setBusy(true);
    try {
      await uncompleteEmails([emailId]);
      showFeedback(t.undone);
    } finally {
      setBusy(false);
    }
  }, [emailId, uncompleteEmails, showFeedback, t]);

  return {
    t,
    lifecycle,
    completed,
    completion: completion as EmailCompletionRecord | undefined,
    showDonePicker,
    setShowDonePicker,
    busy,
    feedback,
    handleMarkRead,
    handleMarkUnread,
    handleComplete,
    handleUndo,
  };
}
