"use client";

import { useEffect } from "react";
import { useUserPreferences } from "@/app/user-preferences-context";

/** Keeps `<html lang>` in sync with the active UI language. */
export function HtmlLangSync() {
  const { uiLanguage } = useUserPreferences();

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  return null;
}
