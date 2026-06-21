import { analyzeFollowUp } from "@/lib/follow-up/analyze";
import { assessReplyNeed } from "@/lib/reply-necessity";
import type { GmailInboxRow } from "@/lib/gmail-api";
import { buildBriefingGroups } from "@/lib/daily-briefing/group";
import { buildBriefingHighlights } from "@/lib/daily-briefing/highlights";
import { buildBriefingInsights } from "@/lib/daily-briefing/insights";
import { detectMessageBriefingSignals } from "@/lib/daily-briefing/detect-signals";
import type {
  AnalyzeDailyBriefingInput,
  DailyBriefingResult,
  DailyBriefingStats,
} from "@/lib/daily-briefing/types";

function daysSince(ms: number): number {
  if (!ms) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000)));
}

function rowFromMessage(
  m: AnalyzeDailyBriefingInput["messages"][number],
): GmailInboxRow {
  return {
    id: m.id,
    threadId: m.threadId ?? m.id,
    sender: m.sender,
    subject: m.subject,
    snippet: m.snippet,
    date: m.date ?? "",
    internalDateMs:
      m.internalDateMs ?? (m.date ? new Date(m.date).getTime() : 0),
  };
}

export function analyzeDailyBriefing(
  input: AnalyzeDailyBriefingInput,
): DailyBriefingResult {
  const locale = input.locale ?? "en";
  const emptyStats: DailyBriefingStats = {
    needsReply: 0,
    followUpsRecommended: 0,
    schoolFamily: 0,
    deadlinesApproaching: 0,
    travelRelated: 0,
    waitingOnOthers: 0,
    meetings: 0,
    payments: 0,
    opportunities: 0,
    promotionUnsubscribe: 0,
  };

  if (!input.messages.length) {
    return {
      active: false,
      generatedAt: new Date().toISOString(),
      highlights: [],
      groups: [],
      insights: [
        {
          id: "empty_inbox",
          tone: "quiet",
          message:
            locale === "it"
              ? "Inbox vuota — giornata leggera."
              : "Empty inbox — a light day ahead.",
        },
      ],
      stats: emptyStats,
    };
  }

  const signals = input.messages.map((m) => {
    const row = rowFromMessage(m);
    const followUp = analyzeFollowUp(row, m.category);
    const replyNeed = assessReplyNeed({ row, category: m.category });

    const followUpRecommended =
      followUp?.state === "follow_up_recommended" ||
      followUp?.state === "user_commitment_pending" ||
      followUp?.atRiskOfForgotten === true;

    const waitingOnOthers = followUp?.state === "waiting_for_response";

    const needsReply =
      replyNeed.recommended ||
      followUp?.state === "awaiting_your_reply" ||
      followUp?.state === "awaiting_approval";

    const paymentPending = followUp?.state === "pending_payment";

    let vipInactiveDays: number | undefined;
    if (
      m.relationship?.importance === "vip" ||
      m.relationship?.kind === "vip_client"
    ) {
      const days = daysSince(row.internalDateMs);
      if (days >= 5 && (needsReply || waitingOnOthers)) {
        vipInactiveDays = days;
      }
    }

    return detectMessageBriefingSignals(m, {
      followUpRecommended,
      waitingOnOthers,
      needsReply,
      paymentPending,
      vipInactiveDays,
    });
  });

  const stats: DailyBriefingStats = {
    needsReply: signals.filter((s) => s.needsReply).length,
    followUpsRecommended: signals.filter((s) => s.followUpRecommended).length,
    schoolFamily: signals.filter((s) => s.schoolFamily).length,
    deadlinesApproaching: signals.filter((s) => s.deadline).length,
    travelRelated: signals.filter((s) => s.travel).length,
    waitingOnOthers: signals.filter((s) => s.waitingOnOthers).length,
    meetings: signals.filter((s) => s.meeting).length,
    payments: signals.filter((s) => s.payment).length,
    opportunities: signals.filter((s) => s.opportunity).length,
    promotionUnsubscribe: signals.filter((s) => s.promotionUnsubscribe).length,
  };

  const highlights = buildBriefingHighlights(stats, locale);
  const groups = buildBriefingGroups(signals, locale);
  const insights = buildBriefingInsights(stats, signals, locale);

  const meaningful =
    highlights.length > 0 ||
    groups.length > 0 ||
    stats.needsReply > 0 ||
    stats.followUpsRecommended > 0;

  return {
    active: meaningful || input.messages.length > 0,
    generatedAt: new Date().toISOString(),
    highlights,
    groups,
    insights,
    stats,
  };
}

export function formatDailyBriefingForPrompt(
  result: DailyBriefingResult,
): string {
  if (!result.active) return "";
  const lines = result.highlights.map((h) => `- ${h.label}`);
  const insight = result.insights[0]?.message;
  return `Daily briefing (informational only — user decides all actions):\n${lines.join("\n")}${insight ? `\nInsight: ${insight}` : ""}`;
}
