"use client";

import { useEffect, useRef, useState } from "react";
import { SYNC_TOAST_EVENT } from "@/lib/read-state/gmail-sync";

const VISIBLE_MS = 5000;

/**
 * Subtle, app-wide toast for background-sync notices (e.g. Gmail read-state
 * failed and is retrying). Calm and quiet — never blocks the user.
 */
export function SyncToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (!detail?.message) return;
      setMessage(detail.message);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMessage(null), VISIBLE_MS);
    };
    window.addEventListener(SYNC_TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(SYNC_TOAST_EVENT, onToast);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 px-4">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-[#0F172A]/90 px-4 py-2.5 text-sm text-white shadow-lg backdrop-blur">
        <span
          aria-hidden
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-accent"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
            <path
              d="M4 10a6 6 0 0110.5-4M16 10a6 6 0 01-10.5 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M14.5 3.5V6H12M5.5 16.5V14H8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="leading-snug text-white/90">{message}</span>
      </div>
    </div>
  );
}
