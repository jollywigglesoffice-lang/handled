"use client";

import { useCallback, useMemo, useState } from "react";
import { ContinuityLines } from "@/app/components/continuity-lines";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import { useUiCopy } from "@/app/use-ui-copy";
import { buildContinuityContext } from "@/lib/continuity-context";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import {
  patchFollowUpReminderOnAccount,
  saveFollowUpReminderToAccount,
} from "@/lib/follow-up-reminders/client-sync";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";
import { safeParseJsonResponse } from "@/lib/safe-json-response";

type FollowUpIntelligenceCardProps = {
  emailId: string;
  analysis: FollowUpAnalysis;
  locale: "en" | "it";
  /** When context is already shown above the fold — actions only */
  actionsOnly?: boolean;
};

export function FollowUpIntelligenceCard({
  emailId,
  analysis,
  locale,
  actionsOnly = false,
}: FollowUpIntelligenceCardProps) {
  const ui = useUiCopy();
  const [status, setStatus] = useState<SaveStatusState>("idle");
  const [draft, setDraft] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);

  const continuity = useMemo(
    () =>
      buildContinuityContext({
        sender: analysis.sender,
        subject: analysis.subject,
        snippet: analysis.snippet,
        followUp: analysis,
        locale,
      }),
    [analysis, locale],
  );

  const displayLines =
    continuity.lines.length > 0
      ? continuity.lines
      : [analysis.headline];

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
        credentials: "include",
        redirect: "manual",
        headers: { "Content-Type": "application/json", ...(await inboxFetchHeaders()) },
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
    <div className="space-y-4 text-sm leading-relaxed">
      {!actionsOnly ? (
        <ContinuityLines lines={displayLines} />
      ) : null}

      <div className={`flex flex-wrap gap-2 ${actionsOnly ? "" : "pt-1"}`}>
        <button
          type="button"
          onClick={() => void handleRemind()}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
        >
          {ui.followUp.remindMeLater}
        </button>
        <button
          type="button"
          onClick={() => void handleDraft()}
          disabled={draftBusy}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {draftBusy ? ui.followUp.draftFollowUpBusy : ui.followUp.draftFollowUpButton}
        </button>
        <button
          type="button"
          onClick={() => void handleSnooze()}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          {ui.followUp.snoozeButton}
        </button>
      </div>

      <SaveStatus status={status} />

      {draft ? (
        <pre className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50/80 p-3 font-sans text-sm text-gray-700">
          {draft}
        </pre>
      ) : null}
    </div>
  );
}
