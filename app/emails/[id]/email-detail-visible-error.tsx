"use client";

import Link from "next/link";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";
import { calmErrorFromRaw } from "@/lib/calm-messages";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";

type EmailDetailVisibleErrorProps = {
  label?: string;
  error: unknown;
  onRetry?: () => void;
};

export function formatDetailError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2);
  } catch {
    return String(error);
  }
}

export function EmailDetailVisibleError({
  label,
  error,
  onRetry,
}: EmailDetailVisibleErrorProps) {
  const ui = useUiCopy();
  const { uiLanguage } = useUserPreferences();
  const locale = uiLocaleFromLanguage(uiLanguage);
  const raw = error instanceof Error ? error.message : formatDetailError(error);
  const calmMessage = calmErrorFromRaw(raw, locale);

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-16 sm:px-6">
      <div className="mx-auto w-full max-w-lg space-y-4 calm-fade-in">
        <Link href="/emails" className="text-sm text-gray-400 hover:text-gray-600">
          {ui.common.backToInbox}
        </Link>
        <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            {ui.calm.errors.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{calmMessage}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="btn-primary-sm"
              >
                {ui.calm.errors.tryAgain}
              </button>
            ) : null}
            <Link href="/emails" className="btn-secondary">
              {ui.common.backToInbox}
            </Link>
          </div>
          <details className="mt-6">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
              {ui.calm.errors.showDetails}
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500">
              {label ? `${label}\n` : ""}
              {formatDetailError(error)}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
