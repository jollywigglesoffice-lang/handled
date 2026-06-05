"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import { parseCompletionLearningJson, recordCompletionLearningWithMeta } from "@/lib/completion-learning/record";
import { trackCompletionLearningRecorded } from "@/lib/completion-learning/track";
import { EMPTY_COMPLETION_LEARNING, type CompletionLearningStats } from "@/lib/completion-learning/types";
import {
  COMPLETION_LEARNING_KEY,
  EMAIL_COMPLETIONS_EVENT,
  loadEmailCompletions,
  mergeCompletionsIntoMap,
  saveEmailCompletions,
} from "@/lib/email-completions/client-storage";
import type {
  CompleteEmailInput,
  EmailCompletionMap,
  EmailCompletionRecord,
} from "@/lib/email-completions/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";

type EmailCompletionsContextValue = {
  completions: EmailCompletionMap;
  completedEmailIds: string[];
  learning: CompletionLearningStats;
  isCompleted: (emailId: string) => boolean;
  getCompletion: (emailId: string) => EmailCompletionRecord | undefined;
  completeEmails: (inputs: CompleteEmailInput[]) => Promise<void>;
  uncompleteEmails: (emailIds: string[]) => Promise<void>;
  /** @deprecated Use completeEmails — kept for gradual migration */
  markEmailHandled: (emailId: string) => void;
};

const EmailCompletionsContext = createContext<EmailCompletionsContextValue | null>(null);

function loadLocalLearning(): CompletionLearningStats {
  if (typeof window === "undefined") return EMPTY_COMPLETION_LEARNING;
  try {
    const raw = localStorage.getItem(COMPLETION_LEARNING_KEY);
    if (!raw) return EMPTY_COMPLETION_LEARNING;
    return parseCompletionLearningJson(JSON.parse(raw));
  } catch {
    return EMPTY_COMPLETION_LEARNING;
  }
}

function saveLocalLearning(stats: CompletionLearningStats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPLETION_LEARNING_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

export function EmailCompletionsProvider({ children }: { children: React.ReactNode }) {
  const [completions, setCompletions] = useState<EmailCompletionMap>(() =>
    typeof window !== "undefined" ? loadEmailCompletions() : {},
  );
  const [learning, setLearning] = useState<CompletionLearningStats>(() => loadLocalLearning());

  const completedEmailIds = useMemo(
    () => Object.keys(completions),
    [completions],
  );

  const refresh = useCallback(async () => {
    try {
      const headers = await protectedApiHeaders();
      const res = await fetch("/api/email-completions", { headers });
      if (!res.ok) return;
      const body = (await res.json()) as {
        completions?: EmailCompletionMap;
        learning?: CompletionLearningStats;
      };
      if (body.completions) {
        setCompletions(body.completions);
        saveEmailCompletions(body.completions);
      }
      if (body.learning) {
        setLearning(body.learning);
        saveLocalLearning(body.learning);
      }
    } catch {
      /* keep local */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sync = () => setCompletions(loadEmailCompletions());
    window.addEventListener(EMAIL_COMPLETIONS_EVENT, sync);
    window.addEventListener("handled-emails-changed", sync);
    return () => {
      window.removeEventListener(EMAIL_COMPLETIONS_EVENT, sync);
      window.removeEventListener("handled-emails-changed", sync);
    };
  }, [refresh]);

  const persistMap = useCallback(
    async (
      nextMap: EmailCompletionMap,
      nextLearning: CompletionLearningStats,
      options?: { records?: EmailCompletionRecord[] },
    ) => {
      setCompletions(nextMap);
      setLearning(nextLearning);
      saveEmailCompletions(nextMap);
      saveLocalLearning(nextLearning);

      try {
        const headers = await protectedApiHeaders();
        if (options?.records?.length) {
          await fetch("/api/email-completions", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ records: options.records }),
          });
        } else {
          await fetch("/api/email-completions", {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ completions: nextMap, learning: nextLearning }),
          });
        }
      } catch {
        /* local ok */
      }
    },
    [],
  );

  const completeEmails = useCallback(
    async (inputs: CompleteEmailInput[]) => {
      if (!inputs.length) return;

      const now = Date.now();
      const records: EmailCompletionRecord[] = inputs.map((input) => {
        const domain = resolveSenderIdentity(input.sender).domain ?? undefined;
        return {
          emailId: input.emailId,
          actionId: input.actionId,
          actionLabel: input.actionLabel,
          completedAt: now,
          sender: input.sender,
          subject: input.subject,
          snippet: input.snippet,
          category: input.category,
          senderDomain: domain,
        };
      });

      let nextLearning = learning;
      for (const record of records) {
        const result = recordCompletionLearningWithMeta(nextLearning, record);
        nextLearning = result.stats;
        trackCompletionLearningRecorded(record, result.updatedPatterns);
      }

      const nextMap = mergeCompletionsIntoMap(completions, records);
      await persistMap(nextMap, nextLearning, { records });
      window.dispatchEvent(new Event("handled-emails-changed"));
    },
    [completions, learning, persistMap],
  );

  const uncompleteEmails = useCallback(
    async (emailIds: string[]) => {
      if (!emailIds.length) return;
      const nextMap = { ...completions };
      for (const id of emailIds) {
        delete nextMap[id];
      }
      await persistMap(nextMap, learning);
      window.dispatchEvent(new Event("handled-emails-changed"));
    },
    [completions, learning, persistMap],
  );

  const markEmailHandled = useCallback(
    (emailId: string) => {
      void completeEmails([
        {
          emailId,
          actionId: "no_action_needed",
          actionLabel: "No action needed",
          sender: "",
          subject: "",
          category: "needs_attention",
        },
      ]);
    },
    [completeEmails],
  );

  const value = useMemo(
    () => ({
      completions,
      completedEmailIds,
      learning,
      isCompleted: (id: string) => Boolean(completions[id]),
      getCompletion: (id: string) => completions[id],
      completeEmails,
      uncompleteEmails,
      markEmailHandled,
    }),
    [completions, completedEmailIds, learning, completeEmails, uncompleteEmails, markEmailHandled],
  );

  return (
    <EmailCompletionsContext.Provider value={value}>
      {children}
    </EmailCompletionsContext.Provider>
  );
}

const EMPTY_COMPLETIONS_CTX: EmailCompletionsContextValue = {
  completions: {},
  completedEmailIds: [],
  learning: EMPTY_COMPLETION_LEARNING,
  isCompleted: () => false,
  getCompletion: () => undefined,
  completeEmails: async () => {},
  uncompleteEmails: async () => {},
  markEmailHandled: () => {},
};

export function useEmailCompletions(): EmailCompletionsContextValue {
  const ctx = useContext(EmailCompletionsContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[email-completions] missing provider — using no-op context");
    }
    return EMPTY_COMPLETIONS_CTX;
  }
  return ctx;
}

/** Back-compat alias */
export function useHandledEmails() {
  const ctx = useEmailCompletions();
  return {
    handledEmailIds: ctx.completedEmailIds,
    markEmailHandled: ctx.markEmailHandled,
  };
}
