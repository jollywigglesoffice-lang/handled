"use client";

import { useCallback } from "react";
import {
  collectActionMemory,
  collectCategoryCorrection,
  collectEmailOpened,
  collectEmailViewedWithoutAction,
  collectUserOverrideLog,
} from "@/lib/client/memory/collect";

/** UI hook — memory signals sync via client layer → `/api/memory/collect`. */
export function useMemoryCollect() {
  const collectCorrection = useCallback(
    (...args: Parameters<typeof collectCategoryCorrection>) =>
      collectCategoryCorrection(...args),
    [],
  );
  const collectOverride = useCallback(
    (...args: Parameters<typeof collectUserOverrideLog>) => collectUserOverrideLog(...args),
    [],
  );
  const collectAction = useCallback(
    (...args: Parameters<typeof collectActionMemory>) => collectActionMemory(...args),
    [],
  );
  const collectOpened = useCallback(
    (...args: Parameters<typeof collectEmailOpened>) => collectEmailOpened(...args),
    [],
  );
  const collectViewedWithoutAction = useCallback(
    (...args: Parameters<typeof collectEmailViewedWithoutAction>) =>
      collectEmailViewedWithoutAction(...args),
    [],
  );

  return {
    collectCategoryCorrection: collectCorrection,
    collectUserOverrideLog: collectOverride,
    collectActionMemory: collectAction,
    collectEmailOpened: collectOpened,
    collectEmailViewedWithoutAction: collectViewedWithoutAction,
  };
}
