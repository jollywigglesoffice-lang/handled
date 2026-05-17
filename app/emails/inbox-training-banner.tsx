"use client";

import { useMemo, useState } from "react";
import {
  type InboxAiCategory,
  inboxCategorySectionTitle,
} from "@/lib/inbox-ai-categories";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";

const TRAINING_KEY = "handled_inbox_training_v1";
const TRAINING_DONE_KEY = "handled_inbox_training_done";

function trainingProgress(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(TRAINING_KEY) ?? "0");
}

function bumpTraining() {
  const next = trainingProgress() + 1;
  localStorage.setItem(TRAINING_KEY, String(next));
  if (next >= 3) {
    localStorage.setItem(TRAINING_DONE_KEY, "1");
  }
}

type InboxTrainingBannerProps = {
  messages: GmailCardMessage[];
  onCategoryChange: (id: string, category: InboxAiCategory) => void;
  onAlwaysSender: (message: GmailCardMessage, category: InboxAiCategory) => void;
};

export function InboxTrainingBanner({
  messages,
  onCategoryChange,
  onAlwaysSender,
}: InboxTrainingBannerProps) {
  const [dismissed, setDismissed] = useState(false);

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

  const label = inboxCategorySectionTitle(sample.category, "en");

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-[#EEF2FF] to-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
        Train Handled
      </p>
      <h3 className="mt-2 text-lg font-semibold text-[#0F172A]">
        Handled thinks this belongs in {label}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        <span className="font-medium text-gray-800">{sample.sender}</span>
        {" — "}
        {sample.subject}
      </p>
      <p className="mt-2 text-sm text-gray-500">Was that correct?</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            bumpTraining();
            setDismissed(true);
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Yes, that&apos;s right
        </button>
        <button
          type="button"
          onClick={() => {
            const next: InboxAiCategory =
              sample.category === "promotion" ? "needs_attention" : "promotion";
            onCategoryChange(sample.id, next);
            bumpTraining();
            setDismissed(true);
          }}
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          No — move it
        </button>
        <button
          type="button"
          onClick={() => {
            onAlwaysSender(sample, sample.category);
            bumpTraining();
            setDismissed(true);
          }}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
        >
          Always trust this sender
        </button>
      </div>
    </section>
  );
}
