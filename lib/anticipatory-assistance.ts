import type { BrainUsageDto } from "@/lib/knowledge/types";
import { analyzeEmailIntent } from "@/lib/email-intent";
import {
  hasExplicitDeadline,
  hasExplicitQuestion,
  hasExplicitRequest,
  hasExplicitSchedulingRequest,
  isAnnouncementEmail,
} from "@/lib/explicit-email-signals";
import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { emailHaystack, isCommercialBulk } from "@/lib/inbox-triage-signals";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { ProactiveAssistantResult } from "@/lib/proactive-assistant";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { TimelineIntelligenceResult } from "@/lib/timeline-intelligence/types";
import { polishNextStep } from "@/lib/situational-understanding";
import { senderDisplayName } from "@/lib/situational-understanding";

export type AnticipatoryLocale = "en" | "it";

export type AnticipatoryEmailInput = {
  sender: string;
  subject: string;
  snippet?: string;
  bodyPlain?: string;
  category?: InboxAiCategory;
  relationship?: SenderRelationshipProfile | null;
  replyRecommended?: boolean;
  schedulingDetected?: boolean;
  suggestedNextAction?: string | null;
  followUpAnalysis?: FollowUpAnalysis | null;
  timelineIntelligence?: TimelineIntelligenceResult | null;
  proactiveAssistant?: ProactiveAssistantResult | null;
  brainUsage?: BrainUsageDto | null;
  locale?: AnticipatoryLocale;
};

export type AnticipatoryBundle = {
  /** Up to two ambient context lines (memory, brain, thread) */
  contextLines: string[];
  likelyNextStep: string | null;
};

function hay(input: AnticipatoryEmailInput): string {
  return `${input.sender} ${input.subject} ${input.snippet ?? ""} ${input.bodyPlain ?? ""}`;
}

function dedupeLines(lines: string[], max: number): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const norm = line.toLowerCase().trim();
    if (!norm) continue;
    if (out.some((x) => x.toLowerCase().trim() === norm)) continue;
    if (out.some((x) => norm.length > 12 && (x.includes(line) || line.includes(x)))) continue;
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

function countTimeOptions(hay: string): number {
  const slots =
    hay.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi) ??
    hay.match(
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunedì|martedì|mercoledì|giovedì|venerdì)\b/gi,
    );
  return slots?.length ?? 0;
}

function brainContextLine(
  usage: BrainUsageDto | null | undefined,
  haystackText: string,
  locale: AnticipatoryLocale,
): string | null {
  if (!usage?.active) return null;
  const top = usage.entries[0];
  if (!top || top.score < 3) return null;

  const topicHay = `${top.title} ${top.category} ${top.contentPreview}`.toLowerCase();

  if (/pricing|quote|preventivo|offerta/i.test(haystackText) && /pric|quote|plan|tariff/i.test(topicHay)) {
    return locale === "it"
      ? "Le tue note sui prezzi potrebbero essere utili qui."
      : "Your saved pricing notes may apply here.";
  }

  if (/policy|policies|refund|terms|policy/i.test(haystackText) && /policy|terms|refund/i.test(topicHay)) {
    return locale === "it"
      ? "Qualcosa dalle tue policy salvate potrebbe rispondere."
      : "Something from your saved policies may help.";
  }

  if (
    (/schedule|meeting|calendar|appuntamento/i.test(haystackText) ||
      /availability|available/i.test(topicHay)) &&
    /schedul|availability|calendar|orari/i.test(topicHay)
  ) {
    return locale === "it"
      ? "Le tue note su disponibilità potrebbero servire."
      : "Your availability notes may be useful.";
  }

  if (usage.entries.length >= 1 && top.title.length <= 48) {
    return locale === "it"
      ? `Potrebbe essere rilevante: «${top.title}».`
      : `May be relevant: “${top.title}.”`;
  }

  return null;
}

function schedulingPreferenceLine(haystackText: string, locale: AnticipatoryLocale): string | null {
  if (/\bthursday\s+afternoon|\bgiovedì\s+pomeriggio/i.test(haystackText)) {
    return locale === "it"
      ? "Hai indicato che i pomeriggi del giovedì ti vanno bene."
      : "You mentioned Thursday afternoons work best.";
  }
  return null;
}

function threadContextLine(
  timeline: TimelineIntelligenceResult | null | undefined,
  locale: AnticipatoryLocale,
): string | null {
  if (!timeline?.active) return null;
  const detail = timeline.calmDetail?.trim();
  const summary = timeline.timelineSummary?.trim();
  const line = detail || summary;
  if (!line) return null;
  if (/open thread|no urgency|thread aperto|nessuna urgenza/i.test(line)) return null;
  if (line.length > 96) return `${line.slice(0, 93)}…`;
  return line;
}

function proactiveLine(
  proactive: ProactiveAssistantResult | null | undefined,
  locale: AnticipatoryLocale,
): string | null {
  const first = proactive?.suggestions?.[0];
  if (!first?.message?.trim()) return null;
  const msg = first.message.trim();
  if (msg.length > 100) return `${msg.slice(0, 97)}…`;
  return msg;
}

function inferLikelyNextStep(
  input: AnticipatoryEmailInput,
  haystackText: string,
  locale: AnticipatoryLocale,
): string | null {
  const row = {
    sender: input.sender,
    subject: input.subject,
    snippet: input.snippet ?? "",
  } as GmailInboxRow;
  const intent = analyzeEmailIntent(row);
  const lowUrgency =
    input.category === "promotions" ||
    input.category === "newsletters" ||
    input.category === "good_to_know" ||
    isCommercialBulk(row);

  if (lowUrgency || isAnnouncementEmail(haystackText)) {
    return locale === "it" ? "Può aspettare." : "Can likely wait.";
  }

  if (
    hasExplicitSchedulingRequest(haystackText) &&
    (/reschedul|new time|nuovo orario|riprenot/i.test(haystackText) ||
      countTimeOptions(haystackText) >= 2)
  ) {
    return locale === "it"
      ? "Conferma uno dei nuovi orari."
      : "Confirm one of the new times.";
  }

  if (hasExplicitSchedulingRequest(haystackText)) {
    return locale === "it"
      ? "Proponi un orario che ti va."
      : "Offer a time that works.";
  }

  if (
    (intent.kinds.includes("pricing_inquiry") || /pricing|quote|preventivo/i.test(haystackText)) &&
    hasExplicitQuestion(haystackText)
  ) {
    return locale === "it"
      ? "Potrebbe servire qualche dettaglio sui prezzi."
      : "This may need pricing details from you.";
  }

  if (
    input.replyRecommended !== false &&
    hasExplicitDeadline(haystackText) &&
    (intent.kinds.includes("deadline") ||
      /\btoday\b|entro oggi|by eod|by friday|entro venerdì/i.test(haystackText))
  ) {
    return locale === "it" ? "Rispondi oggi." : "Reply today.";
  }

  if (input.replyRecommended !== false && hasExplicitQuestion(haystackText)) {
    return locale === "it"
      ? "Quando puoi, una risposta breve dovrebbe bastare."
      : "When you're ready, a short reply should help.";
  }

  if (hasExplicitRequest(haystackText) && /awaiting approval|need your approval/i.test(haystackText)) {
    return locale === "it"
      ? "Un sì o un no veloce potrebbe bastare."
      : "A quick yes or no may be enough.";
  }

  if (input.followUpAnalysis?.state === "user_commitment_pending") {
    return locale === "it"
      ? "Potresti chiudere un impegno che avevi lasciato aperto."
      : "You may want to close a loop you left open.";
  }

  const polished = polishNextStep(input.suggestedNextAction, locale);
  return polished;
}

export function buildAnticipatoryBundle(input: AnticipatoryEmailInput): AnticipatoryBundle {
  const locale = input.locale ?? "en";
  const haystackText = hay(input);

  const candidates = [
    brainContextLine(input.brainUsage, haystackText, locale),
    schedulingPreferenceLine(haystackText, locale),
    threadContextLine(input.timelineIntelligence, locale),
    proactiveLine(input.proactiveAssistant, locale),
  ].filter((x): x is string => Boolean(x));

  const contextLines = dedupeLines(candidates, 2);
  const likelyNextStep = inferLikelyNextStep(input, haystackText, locale);

  return { contextLines, likelyNextStep };
}

/** Merge continuity + anticipatory ambient lines (max two). */
export function mergeAmbientContextLines(
  continuityLines: string[],
  anticipatoryLines: string[],
  max = 2,
): string[] {
  return dedupeLines([...continuityLines, ...anticipatoryLines], max);
}
