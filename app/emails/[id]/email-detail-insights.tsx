"use client";

import { ActionIntelligenceCard } from "@/app/emails/action-intelligence-card";
import { DecisionAssistanceCard } from "@/app/emails/decision-assistance-card";
import { FollowUpIntelligenceCard } from "@/app/emails/follow-up-intelligence-card";
import { IntelligenceFallbackNote } from "@/app/emails/intelligence-fallback-note";
import { ProactiveAssistantCard } from "@/app/emails/proactive-assistant-card";
import { TimelineIntelligenceCard } from "@/app/emails/timeline-intelligence-card";
import { UnsubscribeIntelligenceCard } from "@/app/emails/unsubscribe-intelligence-card";
import { CalmCollapsible } from "@/app/components/calm-collapsible";
import { useUiCopy } from "@/app/use-ui-copy";
import { continuityFromEmailDetail } from "@/lib/continuity-context";
import type { EmailDetailPayload } from "./email-detail-view";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";

type EmailDetailInsightsProps = {
  email: EmailDetailPayload;
  locale: "en" | "it";
  enrichmentEnabled: boolean;
  workflowMode: import("@/lib/workflow-mode").WorkflowMode;
  onUseReplyDraft: (text: string) => void;
};

function hasInsightContent(email: EmailDetailPayload): boolean {
  return Boolean(
    email.timelineIntelligence?.active ||
    email.proactiveAssistant?.active ||
    email.decisionAssistance?.active ||
    email.actionIntelligence?.actionable ||
    email.followUpAnalysis ||
    email.unsubscribeAnalysis ||
    email.needsCalendarContext ||
    (email.enrichmentWarnings && email.enrichmentWarnings.length > 0),
  );
}

export function EmailDetailInsights({
  email,
  locale,
  enrichmentEnabled,
  workflowMode,
  onUseReplyDraft,
}: EmailDetailInsightsProps) {
  const ui = useUiCopy();
  const continuity = continuityFromEmailDetail(
    {
      sender: email.sender,
      subject: email.subject,
      summary: email.summary,
      bodyPlain: email.bodyPlain,
      relationship: email.relationship,
      followUpAnalysis: email.followUpAnalysis,
      timelineIntelligence: email.timelineIntelligence,
    },
    locale,
  );

  if (!enrichmentEnabled && !hasInsightContent(email)) {
    return null;
  }

  const timeline = email.timelineIntelligence;
  const decision = email.decisionAssistance;
  const proactive = email.proactiveAssistant;
  const action = email.actionIntelligence;

  const whySummary =
    locale === "it"
      ? `Categoria: ${email.inboxCategory ? inboxCategorySectionTitle(email.inboxCategory, "it") : "—"}`
      : `Category: ${email.inboxCategory ? inboxCategorySectionTitle(email.inboxCategory, "en") : "—"}`;

  return (
    <section className="mt-10 border-t border-gray-100 pt-1 opacity-90">
      <p className="mb-1 py-3 text-xs text-gray-400">
        {locale === "it" ? "Se serve, Handled può mostrarti altro" : "When you need it"}
      </p>

      <CalmCollapsible
        title={locale === "it" ? "Perché Handled l'ha segnalata" : "Why Handled flagged this"}
        summary={whySummary}
      >
        <div className="space-y-3 leading-relaxed">
          {email.inboxCategory ? (
            <p>
              <span className="text-gray-500">
                {locale === "it" ? "Categoria inbox" : "Inbox category"}:{" "}
              </span>
              {inboxCategorySectionTitle(email.inboxCategory, locale)}
            </p>
          ) : null}
          {email.replySuppressedReason ? (
            <p className="text-gray-600">{email.replySuppressedReason}</p>
          ) : null}
          {email.suggestedTriageAction ? (
            <p className="text-gray-600">{email.suggestedTriageAction}</p>
          ) : null}
          {!email.inboxCategory && !email.replySuppressedReason && !email.suggestedTriageAction ? (
            <p className="text-gray-500">{ui.calm.empty.noTriageNotes}</p>
          ) : null}
        </div>
      </CalmCollapsible>

      {email.needsCalendarContext ? (
        <CalmCollapsible
          title={locale === "it" ? "Programmazione" : "Scheduling"}
          summary={
            locale === "it" ? "Propongono un orario" : "They're proposing a time"
          }
        >
          <p className="text-sm leading-relaxed text-gray-600">
            {locale === "it"
              ? "Handled può suggerire orari in bozza — tu approvi prima di inviare."
              : "Handled can suggest times in your draft — you approve before anything sends."}
          </p>
        </CalmCollapsible>
      ) : null}

      {timeline?.active && continuity.lines.length === 0 ? (
        <CalmCollapsible
          title={locale === "it" ? "Prima in questo thread" : "Earlier in this thread"}
          summary={timeline.timelineSummary?.slice(0, 72) ?? undefined}
        >
          <TimelineIntelligenceCard
            analysis={timeline}
            locale={locale}
            sender={email.sender}
            subject={email.subject}
            snippet={email.summary}
          />
        </CalmCollapsible>
      ) : null}

      {proactive?.active && (proactive.suggestions?.length ?? 0) > 0 ? (
        <CalmCollapsible
          title={locale === "it" ? "Altre idee" : "Other ideas"}
          summary={`${proactive.suggestions.length} ${locale === "it" ? "suggerimenti" : "suggestions"}`}
        >
          <ProactiveAssistantCard analysis={proactive} locale={locale} />
        </CalmCollapsible>
      ) : null}

      {decision?.active &&
      ((decision.insights?.length ?? 0) > 0 ||
        (decision.opportunities?.length ?? 0) > 0 ||
        (decision.risks?.length ?? 0) > 0) ? (
        <CalmCollapsible
          title={locale === "it" ? "Da tenere a mente" : "Things to keep in mind"}
          summary={
            locale === "it"
              ? "Note utili, senza rumore"
              : "Useful notes, without the noise"
          }
        >
          <DecisionAssistanceCard analysis={decision} locale={locale} />
        </CalmCollapsible>
      ) : null}

      {action?.actionable && action?.primaryLabel && action.suggestedNextAction ? (
        <CalmCollapsible
          title={locale === "it" ? "Altri dettagli sul passo" : "More on this step"}
          summary={action.suggestedNextAction.slice(0, 72)}
        >
          <ActionIntelligenceCard analysis={action} locale={locale} />
        </CalmCollapsible>
      ) : null}

      {email.followUpAnalysis ? (
        <CalmCollapsible
          title={locale === "it" ? "Se vuoi muoverti" : "If you want to act"}
          summary={email.followUpAnalysis.headline.slice(0, 72)}
        >
          <FollowUpIntelligenceCard
            emailId={email.id}
            analysis={email.followUpAnalysis}
            locale={locale}
            actionsOnly={continuity.lines.length > 0}
          />
        </CalmCollapsible>
      ) : null}

      <CalmCollapsible
        title={locale === "it" ? "Iscrizione / newsletter" : "Unsubscribe"}
        summary={
          (email.unsubscribeAnalysis?.methods?.length ?? 0) > 0
            ? locale === "it"
              ? "Opzioni disiscrizione rilevate"
              : "Unsubscribe options detected"
            : locale === "it"
              ? "Gestione preferenze"
              : "Preference management"
        }
      >
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
          onUseReplyDraft={onUseReplyDraft}
        />
      </CalmCollapsible>

      {email.enrichmentWarnings && email.enrichmentWarnings.length > 0 ? (
        <CalmCollapsible
          title={locale === "it" ? "Nota" : "Note"}
          defaultOpen={false}
        >
          <IntelligenceFallbackNote
            message={
              locale === "it"
                ? "Handled ha mostrato l'essenziale — alcuni dettagli opzionali arriveranno dopo."
                : "Handled showed what matters — a few optional details will catch up later."
            }
          />
        </CalmCollapsible>
      ) : null}
    </section>
  );
}
