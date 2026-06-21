"use client";

import Link from "next/link";
import type { TimeStripGroup } from "@/lib/time-impact/time-strip";

type InboxTimeStripProps = {
  groups: TimeStripGroup[];
  locale: "en" | "it";
};

function emailHref(id: string, accountId?: string): string {
  const base = `/emails/${encodeURIComponent(id)}`;
  if (accountId) return `${base}?accountId=${encodeURIComponent(accountId)}`;
  return base;
}

const KIND_DOT = {
  time_blocker: "bg-violet-400",
  time_sensitive: "bg-amber-400",
  time_free: "bg-gray-300",
} as const;

/**
 * Top-of-inbox horizon summary — when things should happen, not inbox order.
 */
export function InboxTimeStrip({ groups, locale }: InboxTimeStripProps) {
  if (!groups.length) return null;

  const title =
    locale === "it" ? "Quando succede" : "When things happen";

  return (
    <section className="border-b border-gray-100 pb-6" aria-label={title}>
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:gap-8">
        {groups.map((group) => (
          <div key={group.band} className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500">{group.label}</p>
            <ul className="mt-2 space-y-2">
              {group.items.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <Link
                    href={emailHref(item.id, item.accountId)}
                    className="group/item block rounded-md py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[item.kind]}`}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800 group-hover/item:text-gray-600">
                          {item.subject}
                        </p>
                        <p className="truncate text-[11px] text-gray-400">
                          {item.sender}
                          {item.deadlineHint ? ` · ${item.deadlineHint}` : null}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
