"use client";

import { useState } from "react";
import { GmailInboxCard, type GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

type InboxClutterSectionProps = {
  messages: GmailCardMessage[];
  locale: "en" | "it";
  onCategoryChange: (
    id: string,
    category: InboxAiCategory,
    options?: InboxCategoryChangeOptions,
  ) => void;
  defaultCollapsed?: boolean;
};

export function InboxClutterSection({
  messages,
  locale,
  onCategoryChange,
  defaultCollapsed = true,
}: InboxClutterSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!messages.length) return null;

  return (
    <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-6 shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-emerald-900">
            Newsletters &amp; promotions
          </p>
          <p className="mt-0.5 text-xs text-emerald-800/80">
            {messages.length} tucked away — expand to review or unsubscribe
          </p>
        </div>
        <span className="text-sm text-emerald-700">{collapsed ? "Show" : "Hide"}</span>
      </button>

      {!collapsed ? (
        <div className="mt-5 space-y-4">
          {messages.map((message) => (
            <GmailInboxCard
              key={message.id}
              message={message}
              locale={locale}
              onCategoryChange={onCategoryChange}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
