"use client";

import { useCallback, useState } from "react";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import { useUiCopy } from "@/app/use-ui-copy";
import { conversationStateLabel } from "@/lib/follow-up/format";
import {
  patchFollowUpReminderOnAccount,
  saveFollowUpReminderToAccount,
} from "@/lib/follow-up-reminders/client-sync";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";
import { safeParseJsonResponse } from "@/lib/safe-json-response";

type FollowUpIntelligenceCardProps = {
  emailId: string;
  analysis: FollowUpAnalysis;
  locale: "en" | "it";
};

export function FollowUpIntelligenceCard({
  emailId,
  analysis,
  locale,
}: FollowUpIntelligenceCardProps) {
  const ui = useUiCopy();
  const [status, setStatus] = useState<SaveStatusState>("idle");
  const [draft, setDraft] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);

  const handleRemind = useCallback(async () => {
    setStatus("saving");
    await saveFollowUpReminderToAccount(analysis);
    setStatus("saved");
    window.dispatchEvent(new Event("handled-follow-ups-changed"));
    window.setTimeout(() => setStatus("idle"), 2000);
  }, [analysis]);

  const handleDraft = useCallback(async () => {
    setDraftBusy(true);
    try {
      const res = await fetch("/api/follow-ups/draft", {
        method: "POST",
        credentials: "same-origin",
        redirect: "manual",
        headers: { "Content-Type": "application/json", ...inboxFetchHeaders() },
        body: JSON.stringify({
          sender: analysis.sender,
          subject: analysis.subject,
          snippet: analysis.snippet,
          state: analysis.state,
        }),
      });
      const parsed = await safeParseJsonResponse<{ draft?: string }>(
        res,
        "/api/follow-ups/draft",
      );
      if (parsed.ok && parsed.data.draft) setDraft(parsed.data.draft);
    } catch (e) {
      console.error("[follow-up-intelligence] draft fetch failed", e);
    } finally {
      setDraftBusy(false);
    }
  }, [analysis]);

  const handleSnooze = useCallback(async () => {
    setStatus("saving");
    await saveFollowUpReminderToAccount(analysis);
    await patchFollowUpReminderOnAccount(emailId, "snooze");
    setStatus("saved");
    window.dispatchEvent(new Event("handled-follow-ups-changed"));
    window.setTimeout(() => setStatus("idle"), 2000);
  }, [analysis, emailId]);

  return (
    <div className="space-y-3 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
        {ui.followUp.intelligenceTitle}
      </p>
      <p className="text-xs font-medium text-violet-800">
        {conversationStateLabel(analysis.state, locale)}
      </p>
      <p className="text-sm font-medium text-[#0F172A]">{analysis.headline}</p>
      <p className="text-sm leading-relaxed text-gray-600">{analysis.calmPrompt}</p>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => void handleRemind()}
          className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-50"
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
          onClick={() => void handleSnooze()}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F8FAFC]"
        >
          {ui.followUp.snoozeButton}
        </button>
      </div>

      <SaveStatus status={status} />

      {draft ? (
        <pre className="whitespace-pre-wrap rounded-lg border border-violet-100 bg-white p-3 font-sans text-sm leading-relaxed text-gray-700">
          {draft}
        </pre>
      ) : null}

      <p className="text-[11px] text-gray-400">
        Calendar sync and automated nudges are coming — for now, Handled keeps a calm memory of what
        matters.
      </p>
    </div>
  );
}
