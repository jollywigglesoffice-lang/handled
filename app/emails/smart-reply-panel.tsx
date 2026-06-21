"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalmShimmerBlock, CalmTypingIndicator } from "@/app/components/calm-loading";
import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import { draftMemoryHeaders } from "@/lib/draft-memory";
import { loadClientHandledBrain } from "@/lib/handled-brain/client-storage";
import { loadClientDraftMemory } from "@/lib/draft-memory";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { safeParseJsonResponse } from "@/lib/safe-json-response";
import {
  assessSmartReply,
  type SmartReplyInput,
} from "@/lib/smart-reply/filter";
import {
  SMART_REPLY_STYLES,
  smartReplyStyleLabel,
  type SmartReplyStyleId,
} from "@/lib/smart-reply/styles";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { trackEvent } from "@/lib/analytics";

type SmartReplyPanelProps = {
  emailId: string;
  accountId?: string;
  sender: string;
  subject: string;
  snippet: string;
  emailContent: string;
  category: InboxAiCategory;
  locale: "en" | "it";
  detailHref?: string;
  onDismiss: () => void;
  onMarkReplied?: () => void;
  /** Force generation even when filter says no (detail view). */
  forceOffer?: boolean;
  /** Detail view — panel stays open, no dismiss control. */
  embedded?: boolean;
  /** Prefill editor (e.g. from calendar scheduling). */
  initialDraft?: string;
};

const COPY = {
  en: {
    title: "Suggested response",
    trust: "Edit freely — copy into Gmail when ready. Never auto-sends.",
    generating: "Writing drafts…",
    editHint: "Edit before you send",
    primary: "Primary",
    alternate: "Alternate",
    copy: "Copy",
    copied: "Copied",
    dismiss: "Dismiss",
    markReplied: "Mark as replied",
    notRecommended: "No action needed",
    notRecommendedHint:
      "This email is informational — no reply is required.",
    openFull: "Open full editor",
    regenerate: "Regenerate",
    error: "Could not generate drafts. Try again.",
  },
  it: {
    title: "Risposta suggerita",
    trust: "Modifica liberamente — copia in Gmail quando vuoi. Non invia mai automaticamente.",
    generating: "Scrittura bozze…",
    editHint: "Modifica prima di inviare",
    primary: "Principale",
    alternate: "Alternativa",
    copy: "Copia",
    copied: "Copiato",
    dismiss: "Chiudi",
    markReplied: "Segna come risposto",
    notRecommended: "Nessuna azione necessaria",
    notRecommendedHint:
      "Questa email è informativa — non serve una risposta.",
    openFull: "Apri editor completo",
    regenerate: "Rigenera",
    error: "Impossibile generare bozze. Riprova.",
  },
} as const;

type DraftMap = Partial<Record<SmartReplyStyleId, string>>;

export function SmartReplyPanel({
  emailId,
  accountId,
  sender,
  subject,
  snippet,
  emailContent,
  category,
  locale,
  detailHref,
  onDismiss,
  onMarkReplied,
  forceOffer = false,
  embedded = false,
  initialDraft,
}: SmartReplyPanelProps) {
  const t = COPY[locale];
  const filterInput: SmartReplyInput = { sender, subject, snippet, category };
  const assessment = assessSmartReply(filterInput);
  const eligible = forceOffer || assessment.recommended;

  const [drafts, setDrafts] = useState<DraftMap>({});
  const [activeStyle, setActiveStyle] = useState<SmartReplyStyleId>("default");
  const [editedDraft, setEditedDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;

      const response = await fetch("/api/reply", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(await protectedApiHeaders(draftMemoryHeaders(userId))),
        },
        signal: controller.signal,
        body: JSON.stringify({
          email: emailContent,
          sender,
          subject,
          snippet,
          category,
          stream: false,
          smartReplyPreset: true,
          replyRecommended: true,
          detailView: forceOffer || undefined,
          brain: loadClientHandledBrain(),
          draftMemory: userId ? loadClientDraftMemory(userId) : undefined,
        }),
      });

      const parsed = await safeParseJsonResponse<{
        replies?: string[];
        error?: string;
        replyRecommended?: boolean;
      }>(response, "/api/reply");

      if (!parsed.ok) {
        setError(t.error);
        return;
      }

      const body = parsed.data;
      const replies = body.replies ?? [];
      if (replies.length === 0) {
        setError(body.error ?? t.error);
        return;
      }

      const next: DraftMap = {};
      SMART_REPLY_STYLES.forEach((style, i) => {
        if (replies[i]?.trim()) next[style.id] = replies[i].trim();
      });
      setDrafts(next);
      const first = next.default ?? next.short ?? next.formal ?? "";
      setEditedDraft(first);
      setActiveStyle(next.default ? "default" : next.short ? "short" : "formal");
      trackEvent("completion_action_selected", { source: "smart_reply_panel" });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [emailContent, sender, subject, snippet, category, forceOffer, t.error]);

  useEffect(() => {
    if (eligible) void generate();
    return () => abortRef.current?.abort();
  }, [eligible, generate]);

  useEffect(() => {
    if (initialDraft?.trim()) {
      setEditedDraft(initialDraft.trim());
    }
  }, [initialDraft]);

  const selectStyle = useCallback(
    (style: SmartReplyStyleId) => {
      setActiveStyle(style);
      const text = drafts[style];
      if (text) setEditedDraft(text);
    },
    [drafts],
  );

  const handleCopy = useCallback(async () => {
    if (!editedDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(editedDraft.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [editedDraft]);

  if (!eligible) {
    return (
      <div className="mt-4 rounded-xl bg-gray-50/80 px-4 py-4">
        <p className="text-sm text-gray-600">{t.notRecommended}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          {assessment.reason || t.notRecommendedHint}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {detailHref ? (
            <Link
              href={detailHref}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline"
            >
              {t.openFull}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            {t.dismiss}
          </button>
        </div>
      </div>
    );
  }

  const alternateStyles = SMART_REPLY_STYLES.filter((s) => s.id !== activeStyle);

  return (
    <div className="mt-4 rounded-xl bg-gray-50/60 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-800">{t.title}</p>
          <p className="mt-0.5 text-xs text-gray-400">{t.trust}</p>
        </div>
        {!embedded ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-gray-400 transition hover:text-gray-600"
          >
            {t.dismiss}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-3 py-4">
          <CalmTypingIndicator />
          <span className="text-sm text-gray-400">{t.generating}</span>
        </div>
      ) : error ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void generate()}
            className="text-xs font-medium text-gray-600 hover:underline"
          >
            {t.regenerate}
          </button>
        </div>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs text-gray-400">{t.primary}</span>
            <textarea
              value={editedDraft}
              onChange={(e) => setEditedDraft(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border-0 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm ring-1 ring-gray-200/80 outline-none focus:ring-gray-300"
              placeholder={t.editHint}
            />
          </label>

          {alternateStyles.some((s) => drafts[s.id]) ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-400">{t.alternate}</p>
              <div className="flex flex-wrap gap-2">
                {alternateStyles.map((style) => {
                  const text = drafts[style.id];
                  if (!text) return null;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => selectStyle(style.id)}
                      className={`max-w-full rounded-lg px-3 py-2 text-left text-xs leading-relaxed transition ${
                        activeStyle === style.id
                          ? "bg-white text-gray-800 shadow-sm ring-1 ring-gray-200"
                          : "bg-white/60 text-gray-500 hover:bg-white hover:text-gray-700"
                      }`}
                    >
                      <span className="block font-medium text-gray-500">
                        {smartReplyStyleLabel(style.id, locale)}
                      </span>
                      <span className="line-clamp-2">{text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!editedDraft.trim()}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {copied ? t.copied : t.copy}
            </button>
            <button
              type="button"
              onClick={() => void generate()}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            >
              {t.regenerate}
            </button>
            {onMarkReplied ? (
              <button
                type="button"
                onClick={onMarkReplied}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                {t.markReplied}
              </button>
            ) : null}
            {detailHref ? (
              <Link
                href={detailHref}
                className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline"
              >
                {t.openFull}
              </Link>
            ) : null}
          </div>
        </>
      )}

      {!loading && Object.keys(drafts).length === 0 && !error && eligible ? (
        <CalmShimmerBlock className="mt-3 h-20 w-full accent" accent />
      ) : null}
    </div>
  );
}
