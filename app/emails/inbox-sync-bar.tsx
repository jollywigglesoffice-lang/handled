"use client";

import { useEffect, useState } from "react";

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
  onRefresh: () => void;
};

export function InboxSyncBar({
  lastSyncedAt,
  isRefreshing,
  autoRefreshEnabled = true,
  onRefresh,
}: InboxSyncBarProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {isRefreshing ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#6366F1] border-t-transparent"
            aria-hidden
          />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        )}
        <span>
          {isRefreshing ? "Checking inbox…" : `Last synced ${formatRelativeSync(lastSyncedAt)}`}
        </span>
        {autoRefreshEnabled && !isRefreshing ? (
          <span className="text-xs text-gray-400">· auto every 3 min</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm font-medium text-[#6366F1] transition hover:bg-[#EEF2FF] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Refresh inbox
      </button>
    </div>
  );
}
