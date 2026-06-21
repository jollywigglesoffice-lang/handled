"use client";

import { useEffect, useState } from "react";
import { useEmailCompletions } from "@/app/email-completions-context";
import { runAutopilotBatch, type AutopilotEmail } from "@/lib/autopilot";

type AutopilotMessage = AutopilotEmail & {
  categorySource?: string;
};

/**
 * Runs AUTO-state actions only — routine mail handled quietly.
 * Every action is logged; user can undo from Handled Log.
 */
export function useAutopilotProcessor(
  messages: AutopilotMessage[],
  locale: "en" | "it",
  enabled: boolean,
): { lastProcessedCount: number; processing: boolean } {
  const { completeEmails } = useEmailCompletions();
  const [lastProcessedCount, setLastProcessedCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!enabled || messages.length === 0) return;

    const candidates = messages.filter(
      (m) => m.autopilot?.canAutoRun && m.autopilot.state === "auto",
    );
    if (!candidates.length) return;

    let cancelled = false;
    setProcessing(true);

    void runAutopilotBatch({
      emails: candidates,
      locale,
      completeEmails,
    })
      .then((count) => {
        if (!cancelled) setLastProcessedCount(count);
      })
      .finally(() => {
        if (!cancelled) setProcessing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [messages, locale, enabled, completeEmails]);

  return { lastProcessedCount, processing };
}
