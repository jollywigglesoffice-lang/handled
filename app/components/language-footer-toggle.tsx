"use client";

import type { AppUiLanguage } from "@/app/user-preferences-context";
import { useUserPreferences } from "@/app/user-preferences-context";

type LanguageFooterToggleProps = {
  className?: string;
};

export function LanguageFooterToggle({ className = "" }: LanguageFooterToggleProps) {
  const { uiLanguage, setUiLanguage } = useUserPreferences();

  return (
    <footer
      className={`flex justify-center ${className}`}
      aria-label={uiLanguage === "it" ? "Lingua" : "Language"}
    >
      <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
        <LangButton
          code="en"
          label="EN"
          active={uiLanguage === "en"}
          onSelect={setUiLanguage}
        />
        <span aria-hidden className="text-gray-300">
          ·
        </span>
        <LangButton
          code="it"
          label="IT"
          active={uiLanguage === "it"}
          onSelect={setUiLanguage}
        />
      </div>
    </footer>
  );
}

function LangButton({
  code,
  label,
  active,
  onSelect,
}: {
  code: AppUiLanguage;
  label: string;
  active: boolean;
  onSelect: (language: AppUiLanguage) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(code)}
      aria-pressed={active}
      className={`rounded px-1 py-0.5 font-medium transition ${
        active
          ? "text-gray-700"
          : "text-gray-400 hover:text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}
