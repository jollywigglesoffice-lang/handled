import type { ThreadMemory } from "@/lib/timeline-intelligence/types";

const REQUESTED =
  /\b(please (?:send|share|attach|confirm|review|approve)|can you|could you|need you to|per favore)\b/gi;

const DEADLINE =
  /\b(by (?:tomorrow|friday|monday|eod)|deadline|due (?:on|by)|entro (?:domani|venerdì)|scadenza)\b/gi;

const ATTACHMENT =
  /\b(attach(?:ed|ment)?|see attached|allegato|in allegato|pdf|document)\b/i;

const COMMITMENT =
  /\b(still waiting|haven'?t received|promised|as discussed|you (?:said|mentioned) you(?:'|')?d)\b/gi;

const USER_SENT =
  /\b(per my (?:last )?email|i (?:sent|shared|attached)|following up on my)\b/i;

const OTHER_WAITING =
  /\b(following up|checking in|any update|still waiting (?:for|on) you)\b/i;

function uniqueMatches(hay: string, pattern: RegExp, max = 3): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags);
  while ((m = re.exec(hay)) !== null && out.length < max) {
    const t = m[0]!.trim().slice(0, 60);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function extractThreadMemory(hay: string): Omit<ThreadMemory, "followUpCount" | "userRepliedHeuristic" | "otherRepliedHeuristic"> {
  return {
    requestedActions: uniqueMatches(hay, REQUESTED),
    mentionedDeadlines: uniqueMatches(hay, DEADLINE),
    mentionedAttachments: ATTACHMENT.test(hay),
    unresolvedCommitments: uniqueMatches(hay, COMMITMENT),
  };
}

export function inferReplyHeuristics(hay: string): Pick<
  ThreadMemory,
  "userRepliedHeuristic" | "otherRepliedHeuristic"
> {
  return {
    userRepliedHeuristic: USER_SENT.test(hay),
    otherRepliedHeuristic: OTHER_WAITING.test(hay) && !USER_SENT.test(hay),
  };
}

export function countFollowUpsInHay(hay: string): number {
  const patterns = [
    /\bfollow(?:-| )?up\b/gi,
    /\bchecking in\b/gi,
    /\bjust (?:wanted to )?check\b/gi,
    /\bsecond reminder\b/gi,
    /\bthird time\b/gi,
    /\bfollowing up again\b/gi,
    /\b(?:re:|fwd:)/gi,
  ];
  let count = 0;
  for (const p of patterns) {
    const m = hay.match(p);
    if (m) count += m.length;
  }
  return Math.min(6, count);
}
