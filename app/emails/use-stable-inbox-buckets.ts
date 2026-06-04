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

/**
 * Recomputes buckets from messages; freezes displayed buckets during network refresh
 * so Today / section counts do not flicker out of sync.
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
  const frozenRef = useRef<InboxBuckets<T>>(live);

  useEffect(() => {
    if (!isRefreshing && !isInitialLoading) {
      frozenRef.current = live;
    }
  }, [live, isRefreshing, isInitialLoading]);

  const isCountsPending = isRefreshing && !isInitialLoading;
  const buckets =
    isCountsPending && frozenRef.current.totalVisible >= 0
      ? frozenRef.current
      : live;

  return { buckets, isCountsPending };
}
