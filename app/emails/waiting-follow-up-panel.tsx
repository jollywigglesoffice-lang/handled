"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useUserPreferences } from "@/app/user-preferences-context";
import { buildWaitingFollowUpDraft } from "@/lib/waiting-on/follow-up-draft";
import { resolveRelationshipForWaiting } from "@/lib/waiting-on/infer-relationship";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { loadClientSenderRelationships } from "@/lib/relationship-intelligence/client-storage";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";
import { safeParseJsonResponse } from "@/lib/safe-json-response";
import { captureInboxReturnFromOpen } from "@/lib/inbox-return-context";

const COPY = {
  en: {
    suggested: "Suggested",
    followUp: "Follow up",
    mayNeed: "May need follow-up",
    generate: "Generate draft",
    generating: "Generating…",
    copy: "Copy draft",
    copied: "Copied",
    openToSend: "Open email to send",
    editHint: "Edit before sending — Handled never sends automatically.",
    dismiss: "Not now",
  },
  it: {
    suggested: "Suggerito",
    followUp: "Follow-up",
    mayNeed: "Potrebbe servire un follow-up",
    generate: "Genera bozza",
    generating: "Generazione…",
    copy: "Copia bozza",
    copied: "Copiata",
    openToSend: "Apri email per inviare",
    editHint: "Modifica prima di inviare — Handled non invia mai automaticamente.",
    dismiss: "Non ora",
  },
} as const;

type WaitingFollowUpPanelProps = {
  record: EmailCompletionRecord;
  locale: "en" | "it";
  showSuggestion?: boolean;
  compact?: boolean;
};

export function WaitingFollowUpPanel({
  record,
  locale,
  showSuggestion = true,
  compact = false,
}: WaitingFollowUpPanelProps) {
  const { userName } = useUserPreferences();
  const t = COPY[locale];
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const relationship = resolveRelationshipForWaiting(record, loadClientSenderRelationships());

  const loadDraft = useCallback(async () => {
    setBusy(true);
    const fallback = buildWaitingFollowUpDraft({
      record,
      userName,
      relationship,
      locale,
    });

    try {
      const res = await fetch("/api/follow-ups/draft", {
        method: "POST",
        credentials: "include",
        redirect: "manual",
        headers: { "Content-Type": "application/json", ...(await inboxFetchHeaders()) },
        body: JSON.stringify({
          sender: record.sender,
          subject: record.subject,
          snippet: record.snippet,
          state: "waiting_for_response",
          userName,
          relationship,
        }),
      });
      const parsed = await safeParseJsonResponse<{ draft?: string }>(res, "/api/follow-ups/draft");
      setDraft(parsed.ok && parsed.data.draft ? parsed.data.draft : fallback);
    } catch {
      setDraft(fallback);
    } finally {
      setBusy(false);
    }
  }, [record, userName, relationship, locale]);

  const handleOpen = useCallback(async () => {
    setExpanded(true);
    if (!draft) await loadDraft();
  }, [draft, loadDraft]);

  const handleCopy = useCallback(async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [draft]);

  if (!showSuggestion && !expanded) return null;

  return (
    <div className={compact ? "mt-2" : "mt-3 border-t border-[#F1F5F9] pt-3"}>
      {!expanded ? (
        <button
          type="button"
          onClick={() => void handleOpen()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-1.5 text-xs font-medium text-violet-900 transition hover:bg-violet-50"
        >
          <span className="text-gray-500">{t.suggested}:</span>
          {t.followUp}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-violet-100 bg-violet-50/30 p-3">
          <p className="text-xs text-violet-900/80">{t.editHint}</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={7}
            className="w-full resize-y rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-sans text-sm leading-relaxed text-gray-800 outline-none focus:border-violet-200 focus:ring-1 focus:ring-violet-100"
            placeholder={busy ? t.generating : ""}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadDraft()}
              disabled={busy}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? t.generating : t.generate}
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!draft}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {copied ? t.copied : t.copy}
            </button>
            <Link
              href={`/emails/${encodeURIComponent(record.emailId)}`}
              onClick={() =>
                captureInboxReturnFromOpen({ view: "waiting", categoryTab: "all" }, record.emailId)
              }
              className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-50"
            >
              {t.openToSend}
            </Link>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600"
            >
              {t.dismiss}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function WaitingFollowUpBadge({ locale }: { locale: "en" | "it" }) {
  return (
    <span className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
      {COPY[locale].mayNeed}
    </span>
  );
}
