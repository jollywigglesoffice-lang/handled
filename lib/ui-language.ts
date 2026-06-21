import type { AppUiLanguage } from "@/app/user-preferences-context";

export const UI_LANGUAGE_STORAGE_KEY = "handled:ui-language";

const APP_UI_LANGUAGES: AppUiLanguage[] = ["en", "it"];

/** Browser language → app UI language (`it*` → Italian, else English). */
export function detectBrowserUiLanguage(): AppUiLanguage {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language?.toLowerCase() ?? "";
  return lang.startsWith("it") ? "it" : "en";
}

export function readStoredUiLanguage(): AppUiLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (stored && APP_UI_LANGUAGES.includes(stored as AppUiLanguage)) {
      return stored as AppUiLanguage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Manual override in localStorage wins; otherwise browser detection. */
export function resolveInitialUiLanguage(): AppUiLanguage {
  return readStoredUiLanguage() ?? detectBrowserUiLanguage();
}

export function persistUiLanguage(language: AppUiLanguage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* ignore */
  }
}
