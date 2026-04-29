"use client";

import { useMemo } from "react";
import { useUserPreferences } from "@/app/user-preferences-context";
import { getUiCopy, uiLocaleFromLanguage } from "@/lib/ui-copy";

export function useUiCopy() {
  const { uiLanguage } = useUserPreferences();

  return useMemo(() => {
    const locale = uiLocaleFromLanguage(uiLanguage);
    return getUiCopy(locale);
  }, [uiLanguage]);
}
