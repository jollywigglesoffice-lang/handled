"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import { useUiCopy } from "@/app/use-ui-copy";
import { conversationStateLabel } from "@/lib/follow-up/format";
import {
  patchFollowUpReminderOnAccount,
  saveFollowUpReminderToAccount,
} from "@/lib/follow-up-reminders/client-sync";
import type { FollowUpInboxItem } from "@/lib/follow-up/types";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";

type FollowUpCardProps = {
  item: FollowUpInboxItem;
  locale: "en" | "it";
  onUpdated?: () => void;
};

export function FollowUpCard({ item, locale, onUpdated }: FollowUpCardProps) {
  const ui = useUiCopy();
  const [status, setStatus] = useState<SaveStatusState>("idle");
  const [draft, setDraft] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const runAction = useCallback(
    async (action: "snooze" | "dismiss" | "resolve") => {
      setStatus("saving");
      await patchFollowUpReminderOnAccount(item.emailId, action);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2000);
      onUpdated?.();
    },
    [item.emailId, onUpdated, ui.followUp],
  );

  const handleRemind = useCallback(async () => {
    setStatus("saving");
    await saveFollowUpReminderToAccount(item);
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 2000);
    onUpdated?.();
  }, [item, onUpdated]);

  const handleDraft = useCallback(async () => {
    setDraftBusy(true);
    try {
      const res = await fetch("/api/follow-ups/draft", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...inboxFetchHeaders() },
        body: JSON.stringify({
          sender: item.sender,
          subject: item.subject,
          snippet: item.snippet,
          state: item.state,
        }),
      });
      const data = (await res.json()) as { draft?: string };
      if (data.draft) setDraft(data.draft);
    } finally {
      setDraftBusy(false);
    }
  }, [item]);

  const handleCopy = useCallback(async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [draft]);

  const stateLabel = conversationStateLabel(item.state, locale);

  return (
    <article className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {stateLabel}
          </p>
          <h3 className="text-base font-medium text-[#0F172A]">{item.headline}</h3>
          <p className="text-sm leading-relaxed text-gray-600">{item.calmPrompt}</p>
          <p className="truncate text-xs text-gray-400">
            {item.sender} — {item.subject}
          </p>
        </div>
        <span
          className="rounded-full border border-violet-200 bg-white px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-violet-800"
          title={ui.followUp.urgencyLabel}
        >
          {item.urgencyScore}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/emails/${encodeURIComponent(item.emailId)}`}
          className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-50"
        >
          {ui.followUp.openEmail}
        </Link>
        <button
          type="button"
          onClick={() => void handleRemind()}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          {ui.followUp.remindMeLater}
        </button>
        <button
          type="button"
          onClick={() => void handleDraft()}
          disabled={draftBusy}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
        >
          {draftBusy ? ui.followUp.draftFollowUpBusy : ui.followUp.draftFollowUpButton}
        </button>
        <button
          type="button"
          onClick={() => void runAction("snooze")}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F8FAFC]"
        >
          {ui.followUp.snoozeButton}
        </button>
        <button
          type="button"
          onClick={() => void runAction("dismiss")}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F8FAFC]"
        >
          {ui.followUp.dismissButton}
        </button>
        <button
          type="button"
          onClick={() => void runAction("resolve")}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F8FAFC]"
        >
          {ui.followUp.resolveButton}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <SaveStatus status={status} />
      </div>

      {draft ? (
        <div className="mt-4 space-y-2 rounded-lg border border-violet-100 bg-white p-3">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
            {draft}
          </pre>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="text-xs font-medium text-violet-700 hover:underline"
          >
            {copied ? ui.followUp.copiedDraft : ui.followUp.copyDraftButton}
          </button>
        </div>
      ) : null}
    </article>
  );
}
