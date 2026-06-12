"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { revertDoneInboxEffects } from "@/lib/inbox-truth/apply-done";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import {
  buildWaitingDashboardItems,
  computeWaitingDashboardSummary,
} from "@/lib/waiting-on/dashboard";
import type {
  WaitingDashboardItem,
  WaitingDashboardSummary,
  WaitingOnMetadataMap,
} from "@/lib/waiting-on/metadata-types";
import {
  createWaitingOnMetadata,
  loadWaitingOnMetadata,
  saveWaitingOnMetadata,
  WAITING_ON_METADATA_EVENT,
} from "@/lib/waiting-on/metadata-storage";
import { completionStorageKey, findScopedEntry } from "@/lib/gmail/account-types";
import { useEmailCompletions } from "@/app/email-completions-context";

type WaitingOnMetadataContextValue = {
  metadata: WaitingOnMetadataMap;
  dashboardItems: WaitingDashboardItem[];
  summary: WaitingDashboardSummary;
  ensureMetadataForWaiting: (
    emailId: string,
    input?: { followUpAt?: number },
  ) => void;
  updateWaitingNote: (emailId: string, note: string) => void;
  setWaitingFollowUpDate: (emailId: string, followUpAt: number | null) => void;
  markWaitingFollowedUp: (emailId: string) => void;
  markWaitingResolved: (emailId: string, locale?: "en" | "it") => Promise<void>;
  returnWaitingToInbox: (emailId: string) => Promise<void>;
};

const WaitingOnMetadataContext = createContext<WaitingOnMetadataContextValue | null>(null);

export function WaitingOnMetadataProvider({ children }: { children: React.ReactNode }) {
  const { completions, patchCompletion, uncompleteEmails, resolveWaiting } =
    useEmailCompletions();
  const [metadata, setMetadata] = useState<WaitingOnMetadataMap>(() =>
    typeof window !== "undefined" ? loadWaitingOnMetadata() : {},
  );

  useEffect(() => {
    const sync = () => setMetadata(loadWaitingOnMetadata());
    sync();
    window.addEventListener(WAITING_ON_METADATA_EVENT, sync);
    return () => window.removeEventListener(WAITING_ON_METADATA_EVENT, sync);
  }, []);

  const persistMetadata = useCallback((next: WaitingOnMetadataMap) => {
    setMetadata(next);
    saveWaitingOnMetadata(next);
  }, []);

  // Metadata keys may be account-scoped (`accountId:emailId`) or legacy raw
  // ids — keyed access resolves the existing entry's actual key.
  const ensureMetadataForWaiting = useCallback(
    (emailId: string, input?: { followUpAt?: number }) => {
      if (findScopedEntry(metadata, emailId)) return;
      const now = Date.now();
      const key = completionStorageKey(
        findScopedEntry(completions, emailId)?.[1] ?? { emailId },
      );
      persistMetadata({
        ...metadata,
        [key]: createWaitingOnMetadata(emailId, input, now),
      });
    },
    [metadata, completions, persistMetadata],
  );

  const upsertMetadata = useCallback(
    (emailId: string, patch: Partial<WaitingOnMetadataMap[string]>) => {
      const now = Date.now();
      const entry = findScopedEntry(metadata, emailId);
      const key =
        entry?.[0] ??
        completionStorageKey(findScopedEntry(completions, emailId)?.[1] ?? { emailId });
      const existing = entry?.[1] ?? createWaitingOnMetadata(emailId, undefined, now);
      persistMetadata({
        ...metadata,
        [key]: { ...existing, ...patch, updatedAt: now },
      });
    },
    [metadata, completions, persistMetadata],
  );

  const updateWaitingNote = useCallback(
    (emailId: string, note: string) => {
      const trimmed = note.trim();
      upsertMetadata(emailId, { note: trimmed || undefined });
    },
    [upsertMetadata],
  );

  const setWaitingFollowUpDate = useCallback(
    async (emailId: string, followUpAt: number | null) => {
      upsertMetadata(emailId, { followUpAt: followUpAt ?? undefined });
      await patchCompletion(emailId, {
        followUpAt: followUpAt ?? undefined,
      });
    },
    [upsertMetadata, patchCompletion],
  );

  const markWaitingFollowedUp = useCallback(
    (emailId: string) => {
      upsertMetadata(emailId, {
        workflowStatus: "followed_up",
        followedUpAt: Date.now(),
      });
    },
    [upsertMetadata],
  );

  const markWaitingResolved = useCallback(
    async (emailId: string, locale: "en" | "it" = "en") => {
      upsertMetadata(emailId, { workflowStatus: "resolved" });
      await resolveWaiting(emailId, "received_response", locale);
    },
    [upsertMetadata, resolveWaiting],
  );

  const returnWaitingToInbox = useCallback(
    async (emailId: string) => {
      const record = findScopedEntry(completions, emailId)?.[1];
      revertDoneInboxEffects([{ id: emailId, accountId: record?.accountId }]);
      const next = { ...metadata };
      delete next[emailId];
      const metaEntry = findScopedEntry(next, emailId, record?.accountId);
      if (metaEntry) delete next[metaEntry[0]];
      persistMetadata(next);
      await uncompleteEmails([emailId]);
    },
    [metadata, completions, persistMetadata, uncompleteEmails],
  );

  const dashboardItems = useMemo(
    () => buildWaitingDashboardItems(completions, metadata, "en"),
    [completions, metadata],
  );

  const summary = useMemo(
    () => computeWaitingDashboardSummary(dashboardItems),
    [dashboardItems],
  );

  const value = useMemo(
    () => ({
      metadata,
      dashboardItems,
      summary,
      ensureMetadataForWaiting,
      updateWaitingNote,
      setWaitingFollowUpDate,
      markWaitingFollowedUp,
      markWaitingResolved,
      returnWaitingToInbox,
    }),
    [
      metadata,
      dashboardItems,
      summary,
      ensureMetadataForWaiting,
      updateWaitingNote,
      setWaitingFollowUpDate,
      markWaitingFollowedUp,
      markWaitingResolved,
      returnWaitingToInbox,
    ],
  );

  return (
    <WaitingOnMetadataContext.Provider value={value}>
      {children}
    </WaitingOnMetadataContext.Provider>
  );
}

export function useWaitingOnMetadata(): WaitingOnMetadataContextValue {
  const ctx = useContext(WaitingOnMetadataContext);
  if (!ctx) {
    return {
      metadata: {},
      dashboardItems: [],
      summary: { total: 0, overdue: 0, longestDays: 0 },
      ensureMetadataForWaiting: () => {},
      updateWaitingNote: () => {},
      setWaitingFollowUpDate: async () => {},
      markWaitingFollowedUp: () => {},
      markWaitingResolved: async () => {},
      returnWaitingToInbox: async () => {},
    };
  }
  return ctx;
}

/** Seed metadata for existing waiting records missing an entry. */
export function useSyncWaitingMetadata(completions: Record<string, EmailCompletionRecord>) {
  useEffect(() => {
    const existing = loadWaitingOnMetadata();
    let next = existing;
    let changed = false;
    const now = Date.now();

    for (const record of Object.values(completions)) {
      if (record.actionId !== "waiting_on_someone" || record.waitingResolvedAt) continue;
      const key = completionStorageKey(record);
      if (next[key] || next[record.emailId]) continue;
      next = {
        ...next,
        [key]: createWaitingOnMetadata(record.emailId, {
          followUpAt: record.followUpAt,
        }, now),
      };
      changed = true;
    }

    if (changed) saveWaitingOnMetadata(next);
  }, [completions]);
}
