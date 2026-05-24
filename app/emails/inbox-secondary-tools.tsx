"use client";

import { CalmCollapsible } from "@/app/components/calm-collapsible";
import { DailyWorkspacePanel } from "@/app/emails/daily-workspace-panel";
import { ContextualSearchPanel } from "@/app/emails/contextual-search-panel";
import { DailyBriefingPanel } from "@/app/emails/daily-briefing-panel";
import { ProactiveSuggestionsPanel } from "@/app/emails/proactive-suggestions-panel";
import { FollowUpsSection } from "@/app/emails/follow-ups-section";
import { InboxTrainingBanner } from "@/app/emails/inbox-training-banner";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

type InboxSecondaryToolsProps = {
  messages: GmailCardMessage[];
  gmailMessages: GmailCardMessage[];
  allVisible: GmailCardMessage[];
  locale: "en" | "it";
  onCategoryChange: (id: string, category: InboxAiCategory) => void;
};

/** Digest, search, follow-ups, training — hidden until expanded. */
export function InboxSecondaryTools({
  messages,
  gmailMessages,
  allVisible,
  locale,
  onCategoryChange,
}: InboxSecondaryToolsProps) {
  const summary =
    locale === "it"
      ? "Briefing, ricerca, follow-up e altro"
      : "Briefing, search, follow-ups & more";

  return (
    <section className="mt-10 border-t border-gray-100 pt-2">
      <CalmCollapsible title={locale === "it" ? "Altri strumenti" : "More tools"} summary={summary}>
        <div className="space-y-8 pt-2">
          <DailyWorkspacePanel messages={messages} />
          <DailyBriefingPanel messages={messages} />
          <ProactiveSuggestionsPanel messages={messages} locale={locale} />
          <FollowUpsSection messages={gmailMessages} locale={locale} />
          <ContextualSearchPanel messages={messages} />
          <InboxTrainingBanner messages={allVisible} onCategoryChange={onCategoryChange} />
        </div>
      </CalmCollapsible>
    </section>
  );
}
