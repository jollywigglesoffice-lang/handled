"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calmInboxFreshnessLabel,
  calmRefreshInboxLabel,
  calmTransitionMessages,
} from "@/lib/calm-system-copy";
import { INBOX_AUTO_REFRESH_MS } from "@/lib/inbox-load/constants";
import { inboxLoadUserMessage } from "@/lib/inbox-load/user-messages";

type InboxSyncBarProps = {
  lastSyncedAt: string | null;
  isRefreshing: boolean;
  autoRefreshEnabled?: boolean;
  rateLimitNotice?: string;
  locale?: "en" | "it";
  onRefresh: () => void;
};

const AUTO_REFRESH_MINUTES = Math.round(INBOX_AUTO_REFRESH_MS / 60_000);

export function InboxSyncBar({
  lastSyncedAt,
  isRefreshing,
  autoRefreshEnabled = true,
  rateLimitNotice,
  locale = "en",
  onRefresh,
}: InboxSyncBarProps) {
  const [, tick] = useState(0);
  const transitions = useMemo(() => calmTransitionMessages(locale), [locale]);
  const [transitionIndex, setTransitionIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isRefreshing) return;
    const id = window.setInterval(() => {
      setTransitionIndex((i) => (i + 1) % transitions.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [isRefreshing, transitions.length]);

  const statusLabel = isRefreshing
    ? transitions[transitionIndex] ?? inboxLoadUserMessage("reconnecting", locale)
    : calmInboxFreshnessLabel(lastSyncedAt, locale);

  return (
    <div className="-mt-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {isRefreshing ? (
            <span className="calm-accent-pulse h-2 w-2 rounded-full" aria-hidden />
          ) : (
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          )}
          <span>{statusLabel}</span>
          {autoRefreshEnabled && !isRefreshing ? (
            <span className="text-xs text-gray-400">
              · {locale === "it" ? `ogni ${AUTO_REFRESH_MINUTES} min` : `every ${AUTO_REFRESH_MINUTES} min`}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-xs font-medium text-accent transition hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {calmRefreshInboxLabel(locale)}
        </button>
      </div>
      {rateLimitNotice ? (
        <p className="text-xs text-amber-700/90">{rateLimitNotice}</p>
      ) : null}
    </div>
  );
}
