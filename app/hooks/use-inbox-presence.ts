"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryTab } from "@/app/emails/category-tabs";
import {
  markInboxPrepared,
  markPresenceObservationShown,
  presenceLineForContext,
  resolveInboxPresence,
  resolvePresenceInitialTab,
  shouldShowPresenceObservation,
} from "@/lib/presence";

type UseInboxPresenceOptions = {
  locale: "en" | "it";
  attentionCount: number;
  waitingCount: number;
  stressActive: boolean;
  filteringAggressive: boolean;
  categoryCounts: Record<string, number>;
  enabled?: boolean;
  /** Hide when another headline already carries continuity (welcome / stress). */
  suppressLine?: boolean;
};

export function useInboxPresence({
  locale,
  attentionCount,
  waitingCount,
  stressActive,
  filteringAggressive,
  categoryCounts,
  enabled = true,
  suppressLine = false,
}: UseInboxPresenceOptions) {
  const [prepared, setPrepared] = useState(false);

  const context = useMemo(() => {
    if (!enabled) return null;
    return resolveInboxPresence({
      locale,
      attentionCount,
      waitingCount,
      stressActive,
      filteringAggressive,
    });
  }, [
    enabled,
    locale,
    attentionCount,
    waitingCount,
    stressActive,
    filteringAggressive,
  ]);

  useEffect(() => {
    if (!enabled || prepared) return;
    markInboxPrepared();
    setPrepared(true);
  }, [enabled, prepared]);

  const initialTab = useMemo((): CategoryTab | null => {
    if (!context) return null;
    return resolvePresenceInitialTab(context, categoryCounts);
  }, [context, categoryCounts]);

  const observationLine = useMemo(() => {
    if (!context || suppressLine || !shouldShowPresenceObservation()) return null;
    return presenceLineForContext(context);
  }, [context, suppressLine]);

  const acknowledgeObservation = () => {
    markPresenceObservationShown();
  };

  return {
    context,
    adjustments: context?.adjustments ?? null,
    initialTab,
    observationLine,
    acknowledgeObservation,
  };
}
