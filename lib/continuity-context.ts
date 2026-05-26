import type { FollowUpAnalysis } from "@/lib/follow-up/types";
import { senderFirstNameFromRow } from "@/lib/follow-up/format";
import type { GmailInboxRow } from "@/lib/gmail-api";
import type { ConversationState } from "@/lib/follow-up/types";
import { senderDisplayName } from "@/lib/situational-understanding";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type {
  ThreadMemory,
  TimelineIntelligenceResult,
} from "@/lib/timeline-intelligence/types";

export type ContinuityLocale = "en" | "it";

export type ContinuityInput = {
  sender: string;
  subject: string;
  snippet?: string;
  bodyPlain?: string;
  relationship?: SenderRelationshipProfile | null;
  followUp?: FollowUpAnalysis | null;
  timeline?: TimelineIntelligenceResult | null;
  daysSinceMessage?: number;
  locale?: ContinuityLocale;
};

export type ContinuityBundle = {
  /** Up to two calm lines for ambient UI — memory, waiting, commitments */
  lines: string[];
  memoryLine?: string;
  waitingOnLine?: string;
  commitmentLine?: string;
};

function haystack(input: ContinuityInput): string {
  return `${input.sender} ${input.subject} ${input.snippet ?? ""} ${input.bodyPlain ?? ""}`;
}

function childNameFromHay(hay: string): string | null {
  const m =
    hay.match(/\b(?:son|daughter|child|figlio|figlia)\s+([A-Z][a-zà-ù]{2,20})\b/i) ??
    hay.match(/\b([A-Z][a-zà-ù]{2,20})(?:'s)?\s+(?:school|class|teacher|scuola)\b/i);
  return m?.[1] ?? null;
}

function topicLabel(subject: string, hay: string, locale: ContinuityLocale): string {
  if (/pricing|quote|proposal|preventivo|offerta/i.test(hay)) {
    return locale === "it" ? "il preventivo" : "pricing";
  }
  if (/schedule|meeting|appointment|call|riunione|appuntamento/i.test(hay)) {
    return locale === "it" ? "l'appuntamento" : "scheduling";
  }
  if (/invoice|payment|fattura|pagamento/i.test(hay)) {
    return locale === "it" ? "il pagamento" : "payment";
  }
  const clean = subject.replace(/^(re|fwd|ris):\s*/gi, "").trim();
  if (clean.length <= 42) return `“${clean}”`;
  return locale === "it" ? "questa email" : "this email";
}

function recencyPhrase(days: number, locale: ContinuityLocale): string | null {
  if (days >= 5 && days <= 13) return locale === "it" ? "la settimana scorsa" : "last week";
  if (days >= 14 && days < 28)
    return locale === "it" ? "qualche settimana fa" : "a couple of weeks ago";
  if (days >= 2 && days < 5) return locale === "it" ? "pochi giorni fa" : "a few days ago";
  if (days >= 28) return locale === "it" ? "qualche tempo fa" : "a while back";
  return null;
}

function buildMemoryLine(input: ContinuityInput, hay: string, locale: ContinuityLocale): string | null {
  const name = senderDisplayName(input.sender);
  const first = senderFirstNameFromRow(input.sender);
  const days = input.daysSinceMessage ?? input.followUp?.daysSinceMessage ?? 0;
  const recency = recencyPhrase(days, locale);
  const rel = input.relationship?.kind;

  if (/pricing|quote|proposal|preventivo/i.test(hay) && days >= 2) {
    return locale === "it"
      ? recency
        ? `Hai già parlato di preventivo con ${first} ${recency}.`
        : `Hai già parlato di preventivo con ${first} in questo thread.`
      : recency
        ? `You already discussed pricing with ${first} ${recency}.`
        : `You already discussed pricing with ${first} in this thread.`;
  }

  if (
    /\bthursday\s+afternoon|\bgiovedì\s+pomeriggio|\bafternoon[s]?\s+work|pomeriggio\s+va\s+bene/i.test(
      hay,
    )
  ) {
    return locale === "it"
      ? "Hai indicato che i pomeriggi del giovedì ti vanno bene."
      : "You mentioned Thursday afternoons work best.";
  }

  if (
    (rel === "school" || /\bschool|scuola|pickup|ritiro|classroom/i.test(hay)) &&
    /\bconfirm|pickup|ritiro|permission|autorizz/i.test(hay)
  ) {
    const child = childNameFromHay(hay);
    if (child) {
      return locale === "it"
        ? `Di solito la scuola di ${child} chiede conferma entro le 18.`
        : `${child}'s school usually asks for confirmation before 6 PM.`;
    }
    return locale === "it"
      ? "La scuola di solito chiede conferma entro il pomeriggio."
      : "School messages often need confirmation before 6 PM.";
  }

  const memory: ThreadMemory | undefined = input.timeline?.threadMemory;
  if (memory?.mentionedAttachments) {
    return locale === "it"
      ? "In questo thread è stato citato un allegato."
      : "An attachment came up earlier in this thread.";
  }

  if (memory?.requestedActions?.[0]) {
    const act = memory.requestedActions[0]!.slice(0, 72);
    return locale === "it"
      ? `Prima avevano chiesto: ${act}.`
      : `They previously asked you to ${act.toLowerCase()}.`;
  }

  if (input.timeline?.progression?.longRunning && days >= 7) {
    return locale === "it"
      ? `Tu e ${first} state andando avanti su questo thread da qualche giorno.`
      : `You and ${first} have been going back and forth on this for a while.`;
  }

  if (recency && days >= 5 && !/newsletter|promotion/i.test(hay)) {
    const topic = topicLabel(input.subject, hay, locale);
    return locale === "it"
      ? `Hai già sentito ${name} su ${topic} ${recency}.`
      : `You already heard from ${name} about ${topic} ${recency}.`;
  }

  return null;
}

function buildWaitingOnLine(
  input: ContinuityInput,
  hay: string,
  locale: ContinuityLocale,
): string | null {
  const who = senderDisplayName(input.sender);
  const first = senderFirstNameFromRow(input.sender);
  const topic = topicLabel(input.subject, hay, locale);
  const days = input.daysSinceMessage ?? input.followUp?.daysSinceMessage ?? 0;
  const state = input.followUp?.state;
  const status = input.timeline?.conversationStatus;

  if (
    state === "waiting_for_response" ||
    state === "follow_up_recommended" ||
    status === "waiting" ||
    status === "stalled" ||
    input.timeline?.threadMemory?.otherRepliedHeuristic
  ) {
    if (/\bconfirm|conferma|approval|approvazione/i.test(hay)) {
      return locale === "it"
        ? `In attesa di conferma da ${who}.`
        : `Still waiting for confirmation from ${who}.`;
    }
    if (days >= 2) {
      return locale === "it"
        ? `${first} non ha ancora risposto a ${topic}.`
        : `${first} hasn't replied to your ${topic === "this email" ? "email" : topic} yet.`;
    }
    return locale === "it"
      ? `In attesa di risposta da ${first}.`
      : `Still waiting to hear back from ${first}.`;
  }

  if (state === "pending_scheduling" || /\bschedule|calendar|appuntamento/i.test(hay)) {
    return locale === "it"
      ? `In attesa di fissare un orario con ${who}.`
      : `Still waiting to lock in a time with ${who}.`;
  }

  if (state === "awaiting_your_reply" || status === "needs_follow_up") {
    return locale === "it"
      ? `${first} potrebbe attendere una tua risposta.`
      : `${first} may be waiting on your reply.`;
  }

  return null;
}

function buildCommitmentLine(
  input: ContinuityInput,
  hay: string,
  locale: ContinuityLocale,
): string | null {
  const state = input.followUp?.state;
  const commitment = input.followUp?.detectedCommitment;
  const deadlines = input.timeline?.threadMemory?.mentionedDeadlines ?? [];

  if (/\bby friday|entro venerdì|by monday|entro lunedì|by tomorrow|entro domani|eod\b/i.test(hay)) {
    const m = hay.match(
      /\b(by friday|entro venerdì|by monday|entro lunedì|by tomorrow|entro domani|eod)\b/i,
    );
    const when = m?.[1] ?? deadlines[0];
    if (when) {
      return locale === "it"
        ? `Era prevista una risposta ${when}.`
        : `A reply was expected ${when}.`;
    }
  }

  if (deadlines[0]) {
    return locale === "it"
      ? `Era prevista una risposta ${deadlines[0]}.`
      : `A reply was expected ${deadlines[0]}.`;
  }

  if (
    state === "user_commitment_pending" ||
    /\bi(?:'|')?ll follow up|follow up this week|ti rispondo|ti scrivo/i.test(hay)
  ) {
    if (/\bthis week|questa settimana/i.test(hay)) {
      return locale === "it"
        ? "Avevi detto che avresti fatto follow-up questa settimana."
        : "You said you'd follow up this week.";
    }
    if (commitment && commitment.length < 80) {
      return locale === "it"
        ? `Promemoria: ${commitment}.`
        : `Reminder: ${commitment}.`;
    }
    return locale === "it"
      ? "C'è un follow-up che avevi in sospeso in questo thread."
      : "You may still owe a follow-up in this thread.";
  }

  if (/\bi(?:'|')?ll (?:send|share|get back|confirm)|i will (?:send|share|get back)/i.test(hay)) {
    return locale === "it"
      ? "In un messaggio precedente avevi promesso di rispondere o inviare qualcosa."
      : "You may have promised a reply or an update in this thread.";
  }

  return null;
}

function dedupeLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const norm = line.toLowerCase().trim();
    if (!norm || out.some((x) => x.toLowerCase().trim() === norm)) continue;
    if (out.some((x) => x.includes(line) || line.includes(x))) continue;
    out.push(line);
  }
  return out.slice(0, 2);
}

/** Ambient continuity — sparse, human, max two lines. */
export function buildContinuityContext(input: ContinuityInput): ContinuityBundle {
  const locale = input.locale ?? "en";
  const hay = haystack(input);

  const memoryLine = buildMemoryLine(input, hay, locale);
  const waitingOnLine = buildWaitingOnLine(input, hay, locale);
  const commitmentLine = buildCommitmentLine(input, hay, locale);

  const lines = dedupeLines(
    [waitingOnLine, commitmentLine, memoryLine].filter((x): x is string => Boolean(x)),
  );

  return { lines, memoryLine: memoryLine ?? undefined, waitingOnLine: waitingOnLine ?? undefined, commitmentLine: commitmentLine ?? undefined };
}

/** Human headline + support line for follow-up surfaces. */
export function headlinesForFollowUpState(input: {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  state: ConversationState;
  days: number;
  commitment?: string;
  relationship?: SenderRelationshipProfile | null;
  locale?: ContinuityLocale;
}): { headline: string; calmPrompt: string } {
  const bundle = buildContinuityContext({
    sender: input.row.sender,
    subject: input.row.subject,
    snippet: input.row.snippet,
    relationship: input.relationship,
    followUp: {
      emailId: "",
      sender: input.row.sender,
      subject: input.row.subject,
      snippet: input.row.snippet ?? "",
      category: "needs_attention",
      state: input.state,
      urgencyScore: 0,
      headline: "",
      calmPrompt: "",
      intentKinds: [],
      reasons: [],
      daysSinceMessage: input.days,
      detectedCommitment: input.commitment,
    },
    daysSinceMessage: input.days,
    locale: input.locale,
  });

  const primary = bundle.waitingOnLine ?? bundle.commitmentLine ?? bundle.memoryLine;
  if (primary) {
    const calm =
      input.locale === "it"
        ? "Nulla parte senza di te."
        : "Nothing moves without you.";
    return { headline: primary, calmPrompt: calm };
  }

  const first = senderFirstNameFromRow(input.row.sender);
  const short =
    input.row.subject.length > 48
      ? `${input.row.subject.slice(0, 45)}…`
      : input.row.subject;

  return {
    headline:
      input.locale === "it"
        ? `Conversazione aperta con ${first}`
        : `Open conversation with ${first}`,
    calmPrompt:
      input.locale === "it"
        ? `Su “${short}” — quando hai un momento.`
        : `About “${short}” — when you have a moment.`,
  };
}

/** Replace generic timeline summary with human continuity when possible. */
export function humanizeTimelineSummary(
  timeline: TimelineIntelligenceResult,
  input: Omit<ContinuityInput, "timeline" | "followUp">,
): { primary: string; detail?: string } {
  const bundle = buildContinuityContext({ ...input, timeline });
  if (bundle.lines[0]) {
    return {
      primary: bundle.lines[0],
      detail: bundle.lines[1],
    };
  }
  return {
    primary: timeline.timelineSummary,
    detail: timeline.calmDetail,
  };
}

export function continuityFromEmailDetail(
  email: {
    sender: string;
    subject: string;
    summary?: string;
    bodyPlain?: string;
    relationship?: SenderRelationshipProfile | null;
    followUpAnalysis?: FollowUpAnalysis;
    timelineIntelligence?: TimelineIntelligenceResult;
  },
  locale: ContinuityLocale = "en",
): ContinuityBundle {
  return buildContinuityContext({
    sender: email.sender,
    subject: email.subject,
    snippet: email.summary,
    bodyPlain: email.bodyPlain,
    relationship: email.relationship,
    followUp: email.followUpAnalysis,
    timeline: email.timelineIntelligence,
    daysSinceMessage: email.followUpAnalysis?.daysSinceMessage,
    locale,
  });
}
