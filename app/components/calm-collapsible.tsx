"use client";

import { useId, useState, type ReactNode } from "react";

type CalmCollapsibleProps = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/** Progressive disclosure without card chrome — inbox, detail, settings. */
export function CalmCollapsible({
  title,
  summary,
  defaultOpen = false,
  children,
  className = "",
}: CalmCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:text-gray-900"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-800">{title}</span>
          {summary && !open ? (
            <span className="mt-0.5 block truncate text-xs text-gray-500">{summary}</span>
          ) : null}
        </span>
        <span
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="pb-2 pt-0">
          {children}
        </div>
      ) : null}
    </div>
  );
}
