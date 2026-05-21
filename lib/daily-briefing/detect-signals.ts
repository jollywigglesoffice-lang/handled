import { detectUpcomingCommitments } from "@/lib/proactive-assistant/detect-commitments";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { DailyBriefingMessage } from "@/lib/daily-briefing/types";

const TRAVEL =
  /\b(flight|itinerary|hotel|travel|trip to|boarding pass|check-?in|volo|viaggio)\b/i;
const OPPORTUNITY =
  /\b(pricing|demo|partnership|proposal|quote|enterprise|pilot|interested in)\b/i;

export type MessageBriefingSignals = {
  emailId: string;
  needsReply: boolean;
  followUpRecommended: boolean;
  waitingOnOthers: boolean;
  meeting: boolean;
  payment: boolean;
  deadline: boolean;
  schoolFamily: boolean;
  travel: boolean;
  opportunity: boolean;
  promotionUnsubscribe: boolean;
  vipInactiveDays?: number;
  handledYesterday: boolean;
};

function isSchoolFamily(rel?: SenderRelationshipProfile | null, hay?: string): boolean {
  if (
    rel?.kind === "school" ||
    rel?.kind === "family" ||
    rel?.kind === "healthcare"
  ) {
    return true;
  }
  return /school|teacher|family|pediatric|scuola|insegnante|genitori|doctor|clinic/i.test(
    hay ?? "",
  );
}

function msForMessage(m: DailyBriefingMessage): number {
  if (typeof m.internalDateMs === "number" && m.internalDateMs > 0) return m.internalDateMs;
  if (m.date) {
    const t = new Date(m.date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function isYesterday(ms: number): boolean {
  if (!ms) return false;
  const d = new Date(ms);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

export function detectMessageBriefingSignals(
  m: DailyBriefingMessage,
  options?: {
    followUpRecommended?: boolean;
    waitingOnOthers?: boolean;
    needsReply?: boolean;
    paymentPending?: boolean;
    vipInactiveDays?: number;
  },
): MessageBriefingSignals {
  const hay = `${m.sender} ${m.subject} ${m.snippet}`;
  const category = m.category;
  const commitments = detectUpcomingCommitments(hay, m.subject, category);

  const deadline = commitments.some((c) => c.kind === "deadline");
  const meeting =
    Boolean(m.needsCalendarContext) ||
    commitments.some((c) => c.kind === "meeting");
  const payment =
    Boolean(options?.paymentPending) ||
    commitments.some((c) => c.kind === "payment");
  const travel = TRAVEL.test(hay) || commitments.some((c) =>
    /travel/i.test(c.description),
  );

  const promotionUnsubscribe =
    category === "promotion" &&
    (Boolean(m.hasUnsubscribeSignal) || /unsubscribe|opt.?out/i.test(hay));

  const opportunity =
    category === "needs_attention" && OPPORTUNITY.test(hay);

  const needsReply =
    Boolean(options?.needsReply) &&
    category !== "promotion" &&
    category !== "newsletter" &&
    category !== "handled";

  return {
    emailId: m.id,
    needsReply,
    followUpRecommended: Boolean(options?.followUpRecommended),
    waitingOnOthers: Boolean(options?.waitingOnOthers),
    meeting,
    payment,
    deadline,
    schoolFamily: isSchoolFamily(m.relationship, hay),
    travel,
    opportunity: opportunity && OPPORTUNITY.test(hay),
    promotionUnsubscribe,
    vipInactiveDays: options?.vipInactiveDays,
    handledYesterday: category === "handled" && isYesterday(msForMessage(m)),
  };
}
