"use client";

import { useEffect, useState } from "react";
import { useUiCopy } from "@/app/use-ui-copy";
import { INBOX_AUTO_REFRESH_MS } from "@/lib/inbox-load/constants";
import { inboxLoadUserMessage } from "@/lib/inbox-load/user-messages";

function formatRelativeSync(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 15) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

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
  const ui = useUiCopy();
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="-mt-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {isRefreshing ? (
            <span className="calm-accent-pulse h-2 w-2 rounded-full" aria-hidden />
          ) : (
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          )}
          <span>
            {isRefreshing
              ? inboxLoadUserMessage("reconnecting", locale)
              : `Last synced ${formatRelativeSync(lastSyncedAt)}`}
          </span>
          {autoRefreshEnabled && !isRefreshing ? (
            <span className="text-xs text-gray-400">
              · auto every {AUTO_REFRESH_MINUTES} min
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-xs font-medium text-accent transition hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh inbox
        </button>
      </div>
      {rateLimitNotice ? (
        <p className="text-xs text-amber-700/90">{rateLimitNotice}</p>
      ) : null}
    </div>
  );
}
