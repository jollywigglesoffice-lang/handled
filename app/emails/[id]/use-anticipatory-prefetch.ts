"use client";

import { useEffect, useRef } from "react";

type UseAnticipatoryPrefetchOptions = {
  emailId: string;
  enabled: boolean;
  /** Fires once when detail is ready — warms route handlers / caches */
  onWarm?: () => void;
};

/**
 * Quiet prefetch: health check + optional warm callback without blocking UI.
 */
export function useAnticipatoryPrefetch({
  emailId,
  enabled,
  onWarm,
}: UseAnticipatoryPrefetchOptions) {
  const warmedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !emailId) return;
    if (warmedRef.current === emailId) return;
    warmedRef.current = emailId;

    const run = () => {
      void fetch("/api/reply/health", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      }).catch(() => {
        /* non-blocking */
      });
      onWarm?.();
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 400 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 80);
    return () => window.clearTimeout(t);
  }, [emailId, enabled, onWarm]);
}
