"use client";

import { useState } from "react";
import Link from "next/link";
import { EmailActions } from "./email-actions";
import { EmailBody } from "./email-body";
import { ActionIntelligenceCard } from "@/app/emails/action-intelligence-card";
import { FollowUpIntelligenceCard } from "@/app/emails/follow-up-intelligence-card";
import type { ActionIntelligenceResult } from "@/lib/action-intelligence";
import { CalendarContextBadge } from "@/app/components/calendar-context-badge";
import { RelationshipBadge } from "@/app/emails/relationship-badge";
import { calendarContextBadgeHint, readCalendarConnectionState } from "@/lib/calendar-awareness";
import { UnsubscribeIntelligenceCard } from "@/app/emails/unsubscribe-intelligence-card";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { UnsubscribeAnalysis } from "@/lib/unsubscribe/types";
import { readWorkflowModeFromStorage } from "@/lib/workflow-mode";
import type { FakeEmail } from "@/lib/fake-emails";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";
import { useUiCopy } from "@/app/use-ui-copy";
import { useUserPreferences } from "@/app/user-preferences-context";
import { uiLocaleFromLanguage } from "@/lib/ui-copy";

export type EmailDetailPayload = FakeEmail & {
  bodyHtml?: string;
  /** Rich plain-text context for reply generation (From/Subject/Body). */
  replyContext?: string;
  inboxCategory?: InboxAiCategory;
  replyRecommended?: boolean;
  replySuppressedReason?: string;
  suggestedTriageAction?: string;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
  unsubscribeAnalysis?: UnsubscribeAnalysis;
  unsubscribeReplyDraft?: string;
  followUpAnalysis?: FollowUpAnalysis;
  relationship?: SenderRelationshipProfile;
  needsCalendarContext?: boolean;
  schedulingIntentDetected?: boolean;
  actionIntelligence?: ActionIntelligenceResult;
};

type EmailDetailViewProps = {
  email: EmailDetailPayload;
};

export function EmailDetailView({ email }: EmailDetailViewProps) {
  const [replyDraftOverride, setReplyDraftOverride] = useState(
    email.unsubscribeReplyDraft ?? "",
  );
  const ui = useUiCopy();
  const { uiLanguage } = useUserPreferences();
  const uiLocale = uiLocaleFromLanguage(uiLanguage);
  const categoryLocale = uiLocale === "it" ? "it" : "en";
  const workflowMode = readWorkflowModeFromStorage();

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <div>
          <Link
            href="/emails"
            className="text-sm font-medium text-[#6366F1] transition-all duration-200 hover:opacity-90 active:scale-95"
          >
            {ui.common.backToInbox}
          </Link>
        </div>

        <section className="space-y-8 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 shadow-sm">
          <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              {ui.emailDetail.sender}
            </p>
            <p className="text-lg font-medium text-[#0F172A]">{email.sender}</p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {email.relationship ? (
                <RelationshipBadge relationship={email.relationship} />
              ) : null}
              {email.needsCalendarContext ? (
                <CalendarContextBadge locale={categoryLocale} />
              ) : null}
            </div>
          </div>

          {email.needsCalendarContext ? (
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 text-sm text-sky-900">
              <p className="font-medium">
                {categoryLocale === "it"
                  ? "Programmazione rilevata"
                  : "Scheduling detected"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-800">
                {calendarContextBadgeHint(
                  readCalendarConnectionState().status,
                  categoryLocale,
                )}
              </p>
            </div>
          ) : null}

          <div className="space-y-2 border-t border-gray-200 pt-8">
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              {ui.emailDetail.subject}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              {email.subject}
            </h1>
            {email.inboxCategory ? (
              <p className="mt-2 inline-block rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-medium text-[#6366F1]">
                {inboxCategorySectionTitle(email.inboxCategory, categoryLocale)}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
            <p className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              {ui.emailDetail.aiSummary}
            </p>
            <p className="text-sm leading-relaxed text-gray-500">{email.aiSummary}</p>
          </div>

          {email.actionIntelligence ? (
            <ActionIntelligenceCard
              analysis={email.actionIntelligence}
              locale={categoryLocale}
            />
          ) : null}

          {email.followUpAnalysis ? (
            <FollowUpIntelligenceCard
              emailId={email.id}
              analysis={email.followUpAnalysis}
              locale={categoryLocale}
            />
          ) : null}

          <UnsubscribeIntelligenceCard
            emailId={email.id}
            sender={email.sender}
            subject={email.subject}
            snippet={email.summary}
            bodyPlain={email.body}
            bodyHtml={email.bodyHtml}
            listUnsubscribe={email.listUnsubscribe}
            listUnsubscribePost={email.listUnsubscribePost}
            inboxCategory={email.inboxCategory}
            initialAnalysis={email.unsubscribeAnalysis}
            workflowMode={workflowMode}
            onUseReplyDraft={(text) => setReplyDraftOverride(text)}
          />

          <div className="space-y-3 border-t border-gray-200 pt-8">
            <p className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
              {ui.emailDetail.fullEmailBody}
            </p>
            <EmailBody bodyHtml={email.bodyHtml} bodyPlain={email.body} />
          </div>
        </section>

        <EmailActions
          emailId={email.id}
          emailContent={email.replyContext ?? email.body}
          senderName={email.sender}
          subject={email.subject}
          snippet={email.summary}
          suggestedReply={replyDraftOverride || email.suggestedReply}
          inboxCategory={email.inboxCategory}
          replyRecommended={email.replyRecommended ?? true}
          replySuppressedReason={email.replySuppressedReason}
          suggestedTriageAction={email.suggestedTriageAction}
          followUpAnalysis={email.followUpAnalysis}
          relationship={email.relationship}
        />
      </div>
    </main>
  );
}
