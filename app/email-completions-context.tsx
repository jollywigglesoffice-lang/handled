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
import { buildEmailCompletionRecord } from "@/lib/email-completions/build-record";
import type {
  CompleteEmailInput,
  EmailCompletionMap,
  EmailCompletionRecord,
} from "@/lib/email-completions/types";
import { trackEvent } from "@/lib/analytics";
import {
  activeWaitingRecords,
  buildResolvedWaitingLabel,
  hasWaitingResponse,
  waitingOpenRecords,
  waitingResponseReceivedRecords,
} from "@/lib/waiting-on/helpers";
import {
  scanWaitingResponseDetections,
  type InboxMessageForWaitingDetect,
  type WaitingDetectOptions,
} from "@/lib/waiting-on/detect-response";
import type { WaitingResolutionReason } from "@/lib/waiting-on/types";
import {
  createWaitingOnMetadata,
  loadWaitingOnMetadata,
  saveWaitingOnMetadata,
} from "@/lib/waiting-on/metadata-storage";
import { completionStorageKey, findScopedEntry } from "@/lib/gmail/account-types";

type EmailCompletionsContextValue = {
  completions: EmailCompletionMap;
  completedEmailIds: string[];
  learning: CompletionLearningStats;
  isCompleted: (emailId: string) => boolean;
  getCompletion: (emailId: string) => EmailCompletionRecord | undefined;
  completeEmails: (
    inputs: CompleteEmailInput[],
    options?: { locale?: "en" | "it" },
  ) => Promise<void>;
  uncompleteEmails: (emailIds: string[]) => Promise<void>;
  resolveWaiting: (
    emailId: string,
    reason: WaitingResolutionReason,
    locale?: "en" | "it",
  ) => Promise<void>;
  markStillWaiting: (emailId: string) => Promise<void>;
  patchCompletion: (
    emailId: string,
    patch: Partial<EmailCompletionRecord>,
  ) => Promise<void>;
  dismissWaitingResponse: (emailId: string) => Promise<void>;
  scanWaitingResponses: (
    messages: InboxMessageForWaitingDetect[],
    options?: WaitingDetectOptions,
  ) => Promise<void>;
  activeWaitingRecords: EmailCompletionRecord[];
  waitingOpenRecords: EmailCompletionRecord[];
  waitingResponseRecords: EmailCompletionRecord[];
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

  const activeWaiting = useMemo(
    () => activeWaitingRecords(completions),
    [completions],
  );

  const waitingOpen = useMemo(
    () => waitingOpenRecords(completions),
    [completions],
  );

  const waitingResponses = useMemo(
    () => waitingResponseReceivedRecords(completions),
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
    async (inputs: CompleteEmailInput[], options?: { locale?: "en" | "it" }) => {
      if (!inputs.length) return;

      const locale = options?.locale ?? "en";
      const now = Date.now();
      const records: EmailCompletionRecord[] = inputs.map((input) =>
        buildEmailCompletionRecord(input, now, locale),
      );

      for (const record of records) {
        if (record.actionId === "waiting_on_someone") {
          const props = {
            email_id: record.emailId,
            waiting_on: record.waitingOn ?? null,
            has_follow_up: Boolean(record.followUpAfterDays),
            thread_id: record.threadId ?? null,
          };
          trackEvent("waiting_created", props);
          trackEvent("waiting_on_created", props);
          if (record.followUpAfterDays) {
            trackEvent("followup_reminder_created", {
              email_id: record.emailId,
              follow_up_days: record.followUpAfterDays,
            });
          }
        }
      }

      let nextLearning = learning;
      for (const record of records) {
        const result = recordCompletionLearningWithMeta(nextLearning, record);
        nextLearning = result.stats;
        trackCompletionLearningRecorded(record, result.updatedPatterns);
      }

      const nextMap = mergeCompletionsIntoMap(completions, records);
      let nextMeta = loadWaitingOnMetadata();
      let metaChanged = false;
      for (const record of records) {
        if (record.actionId !== "waiting_on_someone") continue;
        // Metadata keys are account-scoped like completion keys; honor any
        // existing legacy raw-keyed entry.
        const metaKey = completionStorageKey(record);
        if (nextMeta[metaKey] || nextMeta[record.emailId]) continue;
        nextMeta = {
          ...nextMeta,
          [metaKey]: createWaitingOnMetadata(record.emailId, {
            followUpAt: record.followUpAt,
          }),
        };
        metaChanged = true;
      }
      if (metaChanged) saveWaitingOnMetadata(nextMeta);

      await persistMap(nextMap, nextLearning, { records });
      window.dispatchEvent(new Event("handled-emails-changed"));
    },
    [completions, learning, persistMap],
  );

  // Completion map keys are account-scoped (`accountId:emailId`); legacy
  // entries use the raw Gmail id. Keyed access goes through findScopedEntry.
  const uncompleteEmails = useCallback(
    async (emailIds: string[]) => {
      if (!emailIds.length) return;
      const nextMap = { ...completions };
      for (const id of emailIds) {
        delete nextMap[id];
        if (!id.includes(":")) {
          const suffix = `:${id}`;
          for (const key of Object.keys(nextMap)) {
            if (key.endsWith(suffix)) delete nextMap[key];
          }
        }
      }
      await persistMap(nextMap, learning);
      window.dispatchEvent(new Event("handled-emails-changed"));
    },
    [completions, learning, persistMap],
  );

  const patchCompletion = useCallback(
    async (emailId: string, patch: Partial<EmailCompletionRecord>) => {
      const entry = findScopedEntry(completions, emailId);
      if (!entry) return;
      const [key, existing] = entry;
      const updated = { ...existing, ...patch };
      const nextMap = { ...completions, [key]: updated };
      await persistMap(nextMap, learning, { records: [updated] });
      window.dispatchEvent(new Event("handled-emails-changed"));
    },
    [completions, learning, persistMap],
  );

  const resolveWaiting = useCallback(
    async (
      emailId: string,
      reason: WaitingResolutionReason,
      locale: "en" | "it" = "en",
    ) => {
      const record = findScopedEntry(completions, emailId)?.[1];
      if (!record || record.actionId !== "waiting_on_someone") return;
      const now = Date.now();
      await patchCompletion(emailId, {
        waitingResolvedAt: now,
        waitingResolutionReason: reason,
        actionLabel: buildResolvedWaitingLabel(record, reason, locale),
      });

      const meta = loadWaitingOnMetadata();
      const metaEntry = findScopedEntry(meta, emailId, record.accountId);
      if (metaEntry) {
        const [metaKey, metaValue] = metaEntry;
        saveWaitingOnMetadata({
          ...meta,
          [metaKey]: { ...metaValue, workflowStatus: "resolved", updatedAt: now },
        });
      }
      const resolveProps = {
        email_id: emailId,
        waiting_on: record.waitingOn ?? null,
        resolution_reason: reason,
        days_waiting: Math.floor(
          (now - (record.stillWaitingAt ?? record.completedAt)) / 86_400_000,
        ),
        had_detected_response: Boolean(record.waitingResponseDetectedAt),
      };
      trackEvent("waiting_resolved", resolveProps);
      trackEvent("waiting_item_resolved", resolveProps);
    },
    [completions, patchCompletion],
  );

  const dismissWaitingResponse = useCallback(
    async (emailId: string) => {
      const entry = findScopedEntry(completions, emailId);
      const record = entry?.[1];
      if (!entry || !record || !hasWaitingResponse(record)) return;
      const [recordKey] = entry;
      const {
        waitingResponseEmailId: _a,
        waitingResponseDetectedAt: _b,
        waitingResponseSender: _c,
        waitingResponseSubject: _d,
        waitingResponseSnippet: _e,
        waitingResponseAt: _f,
        ...cleared
      } = record;
      const restored: EmailCompletionRecord = { ...cleared, waitingStatus: "waiting" };
      const nextMap = { ...completions, [recordKey]: restored };
      await persistMap(nextMap, learning, { records: [restored] });
      window.dispatchEvent(new Event("handled-emails-changed"));
    },
    [completions, learning, persistMap],
  );

  const scanWaitingResponses = useCallback(
    async (messages: InboxMessageForWaitingDetect[], options?: WaitingDetectOptions) => {
      const pending = waitingOpenRecords(completions);
      if (!pending.length || !messages.length) return;

      const detections = scanWaitingResponseDetections(pending, messages, options);
      if (!detections.length) return;

      const now = Date.now();
      let nextMap = { ...completions };
      const patched: EmailCompletionRecord[] = [];

      for (const { waitingEmailId, detection } of detections) {
        const entry = findScopedEntry(nextMap, waitingEmailId);
        if (!entry) continue;
        const [recordKey, existing] = entry;
        if (existing.waitingResponseDetectedAt) continue;

        const updated: EmailCompletionRecord = {
          ...existing,
          waitingStatus: "response_received",
          waitingResponseEmailId: detection.responseEmailId,
          waitingResponseDetectedAt: now,
          waitingResponseSender: detection.responseSender,
          waitingResponseSubject: detection.responseSubject,
          waitingResponseSnippet: detection.responseSnippet,
          waitingResponseAt: detection.responseAt,
          threadId: existing.threadId ?? detection.threadId,
        };
        nextMap[recordKey] = updated;
        patched.push(updated);

        trackEvent("response_detected", {
          waiting_email_id: waitingEmailId,
          response_email_id: detection.responseEmailId,
          waiting_on: existing.waitingOn ?? null,
          thread_id: detection.threadId,
        });
      }

      if (patched.length) {
        await persistMap(nextMap, learning, { records: patched });
        window.dispatchEvent(new Event("handled-emails-changed"));
      }
    },
    [completions, learning, persistMap],
  );

  const markStillWaiting = useCallback(
    async (emailId: string) => {
      const record = findScopedEntry(completions, emailId)?.[1];
      if (!record || record.actionId !== "waiting_on_someone") return;
      await patchCompletion(emailId, { stillWaitingAt: Date.now() });
    },
    [completions, patchCompletion],
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
      isCompleted: (id: string) => Boolean(findScopedEntry(completions, id)),
      getCompletion: (id: string) => findScopedEntry(completions, id)?.[1],
      completeEmails,
      uncompleteEmails,
      resolveWaiting,
      markStillWaiting,
      patchCompletion,
      dismissWaitingResponse,
      scanWaitingResponses,
      activeWaitingRecords: activeWaiting,
      waitingOpenRecords: waitingOpen,
      waitingResponseRecords: waitingResponses,
      markEmailHandled,
    }),
    [
      completions,
      completedEmailIds,
      learning,
      completeEmails,
      uncompleteEmails,
      resolveWaiting,
      markStillWaiting,
      patchCompletion,
      dismissWaitingResponse,
      scanWaitingResponses,
      activeWaiting,
      waitingOpen,
      waitingResponses,
      markEmailHandled,
    ],
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
  resolveWaiting: async () => {},
  markStillWaiting: async () => {},
  patchCompletion: async () => {},
  dismissWaitingResponse: async () => {},
  scanWaitingResponses: async () => {},
  activeWaitingRecords: [],
  waitingOpenRecords: [],
  waitingResponseRecords: [],
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
