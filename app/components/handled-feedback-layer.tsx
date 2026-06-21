"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { captureScreenContext } from "@/lib/product-feedback/capture-screen-context";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@/lib/product-feedback/types";

const COPY = {
  en: {
    tooltip: "Built by humans. Help us improve.",
    openLabel: "Send feedback",
    title: "Send feedback",
    messagePlaceholder: "Tell us what happened…",
    includeContext: "Include current screen context",
    send: "Send",
    cancel: "Cancel",
    thanks: "Thanks — we read every message.",
    error: "Could not send feedback. Try again.",
    close: "Close",
  },
  it: {
    tooltip: "Creato da persone. Aiutaci a migliorare.",
    openLabel: "Invia feedback",
    title: "Invia feedback",
    messagePlaceholder: "Raccontaci cosa è successo…",
    includeContext: "Includi contesto schermo attuale",
    send: "Invia",
    cancel: "Annulla",
    thanks: "Grazie — leggiamo ogni messaggio.",
    error: "Impossibile inviare il feedback. Riprova.",
    close: "Chiudi",
  },
} as const;

function isFeedbackRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/emails" || pathname.startsWith("/emails/");
}

export function HandledFeedbackLayer() {
  const pathname = usePathname();
  const visible = isFeedbackRoute(pathname);
  const locale = "en" as const;
  const t = COPY[locale];
  const titleId = useId();
  const descId = useId();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [message, setMessage] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setCategory("other");
    setMessage("");
    setIncludeContext(true);
    setError(null);
    setSent(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(resetForm, 200);
  }, [resetForm]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !message.trim()) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/product-feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          includeContext,
          context: includeContext ? captureScreenContext() : null,
        }),
      });

      if (!res.ok) {
        setError(t.error);
        return;
      }

      setSent(true);
      window.setTimeout(close, 2200);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      {!open ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[85]">
          <div className="group pointer-events-auto relative">
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full right-0 mb-2 max-w-[220px] translate-y-1 rounded-lg bg-gray-900/90 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              {t.tooltip}
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t.openLabel}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/75 text-lg shadow-sm ring-1 ring-gray-200/80 backdrop-blur-sm transition duration-200 hover:scale-105 hover:bg-white hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 opacity-60"
            >
              <span aria-hidden className="select-none leading-none">
                💬
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[125] flex items-end justify-center p-4 sm:items-center sm:p-6"
          role="presentation"
          onClick={close}
        >
          <div
            className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-gray-200/80 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold text-gray-900">
                {t.title}
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
                aria-label={t.close}
              >
                ×
              </button>
            </div>

            <p id={descId} className="mt-1 text-xs text-gray-400">
              {t.tooltip}
            </p>

            {sent ? (
              <p className="mt-6 text-sm text-emerald-700">{t.thanks}</p>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
                <fieldset>
                  <legend className="sr-only">Category</legend>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_CATEGORIES.map((value) => (
                      <label
                        key={value}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          category === value
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200/80"
                        }`}
                      >
                        <input
                          type="radio"
                          name="feedback-category"
                          value={value}
                          checked={category === value}
                          onChange={() => setCategory(value)}
                          className="sr-only"
                        />
                        {FEEDBACK_CATEGORY_LABELS[value][locale]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="sr-only">{t.messagePlaceholder}</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    rows={4}
                    required
                    minLength={3}
                    className="w-full resize-y rounded-xl border-0 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 ring-1 ring-gray-200/80 outline-none placeholder:text-gray-400 focus:ring-gray-300"
                  />
                </label>

                <label className="flex items-start gap-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={includeContext}
                    onChange={(e) => setIncludeContext(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <span>{t.includeContext}</span>
                </label>

                {error ? <p className="text-xs text-red-600">{error}</p> : null}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={busy || message.trim().length < 3}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                  >
                    {busy ? "…" : t.send}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
