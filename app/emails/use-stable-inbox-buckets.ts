"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildInboxBuckets, type InboxBucketMessage, type InboxBuckets } from "@/lib/inbox-buckets";
import type { WorkflowMode } from "@/lib/workflow-mode";

type Options<T extends InboxBucketMessage> = {
  messages: T[];
  workflowMode: WorkflowMode;
  isRefreshing: boolean;
  isInitialLoading: boolean;
};

export type StableInboxBucketsResult<T extends InboxBucketMessage> = {
  buckets: InboxBuckets<T>;
  /** True while a refresh is in flight — UI may show prior counts */
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
}: Options<T>): StableInboxBucketsResult<T> {
  const live = useMemo(
    () => buildInboxBuckets(messages, workflowMode),
    [messages, workflowMode],
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
