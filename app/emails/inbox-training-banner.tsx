"use client";

import { useMemo, useState } from "react";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { CategoryCorrectionPanel } from "@/app/emails/category-correction-panel";
import { submitCategoryFeedback } from "@/lib/apply-category-feedback";
import type { CategoryApplyScope } from "@/lib/category-correction";

const TRAINING_KEY = "handled_inbox_training_v1";
const TRAINING_DONE_KEY = "handled_inbox_training_done";

function bumpTraining() {
  const next = Number(localStorage.getItem(TRAINING_KEY) ?? "0") + 1;
  localStorage.setItem(TRAINING_KEY, String(next));
  if (next >= 3) {
    localStorage.setItem(TRAINING_DONE_KEY, "1");
  }
}

type InboxTrainingBannerProps = {
  messages: GmailCardMessage[];
  onCategoryChange: (id: string, category: InboxAiCategory) => void;
};

export function InboxTrainingBanner({ messages, onCategoryChange }: InboxTrainingBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [feedback, setFeedback] = useState("");

  const sample = useMemo(() => {
    if (messages.length === 0) return null;
    const promo = messages.find((m) => m.category === "promotion" || m.category === "newsletter");
    const attention = messages.find((m) => m.category === "needs_attention");
    return promo ?? attention ?? messages[0];
  }, [messages]);

  if (dismissed || !sample) return null;
  if (typeof window !== "undefined" && localStorage.getItem(TRAINING_DONE_KEY) === "1") {
    return null;
  }

  async function handleApply(chosen: InboxAiCategory, scope: CategoryApplyScope) {
    onCategoryChange(sample!.id, chosen);
    if (scope === "this_email" && chosen === sample!.category) {
      bumpTraining();
      setDismissed(true);
      setFeedback("Got it — Handled will keep this guess.");
      return;
    }
    try {
      const result = await submitCategoryFeedback({
        emailId: sample!.id,
        sender: sample!.sender,
        subject: sample!.subject,
        snippet: sample!.snippet,
        guessedCategory: sample!.category,
        chosenCategory: chosen,
        scope,
        accountId: sample!.accountId,
      });
      setFeedback(result.message);
      bumpTraining();
      setDismissed(true);
      window.dispatchEvent(new Event("handled-inbox-rules-changed"));
      window.dispatchEvent(new Event("handled-sender-preferences-changed"));
      if (scope !== "this_email") {
        window.dispatchEvent(new Event("handled-inbox-refresh-requested"));
      }
    } catch {
      setFeedback("Saved on this device.");
      setDismissed(true);
    }
  }

  return (
    <div className="space-y-2">
      <CategoryCorrectionPanel
        target={{
          id: sample.id,
          sender: sample.sender,
          subject: sample.subject,
          snippet: sample.snippet,
          guessedCategory: sample.category,
        }}
        onApply={handleApply}
        onDismiss={() => setDismissed(true)}
      />
      {feedback ? <p className="text-center text-xs text-emerald-700">{feedback}</p> : null}
    </div>
  );
}
