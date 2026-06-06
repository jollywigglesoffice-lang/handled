"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildInboxBuckets, type InboxBucketMessage, type InboxBuckets } from "@/lib/inbox-buckets";
import type { InboxCategoryCatalog } from "@/lib/inbox-category-catalog";
import { EMPTY_CATEGORY_CATALOG } from "@/lib/inbox-category-catalog";
import type { WorkflowMode } from "@/lib/workflow-mode";

type Options<T extends InboxBucketMessage> = {
  messages: T[];
  workflowMode: WorkflowMode;
  isRefreshing: boolean;
  isInitialLoading: boolean;
  catalog?: InboxCategoryCatalog;
};

export type StableInboxBucketsResult<T extends InboxBucketMessage> = {
  buckets: InboxBuckets<T>;
  isCountsPending: boolean;
};

type FrozenCounts = Pick<
  InboxBuckets<InboxBucketMessage>,
  "counts" | "todayAttentionCount" | "priorityCount"
>;

/**
 * Recomputes buckets from messages on every local change (including manual
 * category moves). During network refresh, only aggregate counts are held
 * steady so section lists still update immediately.
 */
export function useStableInboxBuckets<T extends InboxBucketMessage>({
  messages,
  workflowMode,
  isRefreshing,
  isInitialLoading,
  catalog = EMPTY_CATEGORY_CATALOG,
}: Options<T>): StableInboxBucketsResult<T> {
  const live = useMemo(
    () => buildInboxBuckets(messages, workflowMode, catalog),
    [messages, workflowMode, catalog],
  );

  const frozenCountsRef = useRef<FrozenCounts>({
    counts: live.counts,
    todayAttentionCount: live.todayAttentionCount,
    priorityCount: live.priorityCount,
  });

  useEffect(() => {
    if (!isRefreshing && !isInitialLoading) {
      frozenCountsRef.current = {
        counts: live.counts,
        todayAttentionCount: live.todayAttentionCount,
        priorityCount: live.priorityCount,
      };
    }
  }, [live, isRefreshing, isInitialLoading]);

  const isCountsPending = isRefreshing && !isInitialLoading;

  const buckets = useMemo((): InboxBuckets<T> => {
    if (!isCountsPending) return live;
    return {
      ...live,
      counts: frozenCountsRef.current.counts as InboxBuckets<T>["counts"],
      todayAttentionCount: frozenCountsRef.current.todayAttentionCount,
      priorityCount: frozenCountsRef.current.priorityCount,
    };
  }, [live, isCountsPending]);

  return { buckets, isCountsPending };
}
