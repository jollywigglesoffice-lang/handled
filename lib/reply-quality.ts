import type { ReplyContextAnalysis } from "@/lib/reply-context-analysis";

const GENERIC_ACK_PATTERNS = [
  /^thanks for (?:sending|sharing) (?:this|it) over/i,
  /^thanks for (?:the update|your (?:email|message))/i,
  /this looks good to me/i,
  /happy to (?:proceed|move forward)/i,
  /i'?m aligned with this/i,
  /got it,?\s*thanks/i,
  /sounds good to me/i,
  /please proceed/i,
  /i'?ve reviewed (?:this|it) and/i,
  /^looks good\.?$/i,
  /^approved\.?$/i,
  /^proceed\.?$/i,
];

export function isGenericAcknowledgmentOnly(reply: string): boolean {
  const t = reply.trim();
  if (t.length < 8) return false;
  return GENERIC_ACK_PATTERNS.some((p) => p.test(t));
}

function replyAddressesTopic(reply: string, ctx: ReplyContextAnalysis): boolean {
  const lower = reply.toLowerCase();

  if (ctx.intent.kinds.includes("pricing_inquiry")) {
    return /pric|plan|tier|corporate|enterprise|seat|employee|quote|send (?:you |over )?(?:the|our)|prepare/i.test(
      lower,
    );
  }
  if (ctx.intent.kinds.includes("sales_lead")) {
    return /interest|demo|call|chat|learn more|happy to|reach out|connect/i.test(lower);
  }
  if (ctx.intent.kinds.includes("scheduling")) {
    return /meet|call|schedule|calendar|time|available|slot/i.test(lower);
  }
  if (ctx.intent.kinds.includes("support_request")) {
    return /help|issue|fix|look into|investigate|sorry|assist/i.test(lower);
  }
  if (ctx.intent.kinds.includes("unsubscribe")) {
    return /unsubscrib|removed|list|preferences|opt.?out/i.test(lower);
  }
  if (ctx.hasDirectQuestion && ctx.questionCount > 0) {
    return /\?/.test(reply) === false
      ? /yes|no|happy to|can|will|would|here|send|let me|absolutely|sure/i.test(lower)
      : true;
  }

  if (ctx.extractedFacts.employeeCount) {
    return (
      lower.includes(String(ctx.extractedFacts.employeeCount)) ||
      /employee|team size|headcount|seat/i.test(lower)
    );
  }

  if (ctx.extractedFacts.senderFirstName) {
    return lower.includes(ctx.extractedFacts.senderFirstName.toLowerCase());
  }

  return true;
}

export type ReplyValidationResult = {
  ok: boolean;
  failures: string[];
};

export function validateGeneratedReplies(
  replies: string[],
  ctx: ReplyContextAnalysis,
): ReplyValidationResult {
  const failures: string[] = [];

  if (ctx.replyNeeded && ctx.hasDirectQuestion && ctx.forbidsGenericAckOnly) {
    for (let i = 0; i < replies.length; i++) {
      const r = replies[i]!.trim();
      if (isGenericAcknowledgmentOnly(r)) {
        failures.push(`reply[${i}]: generic acknowledgment only — question requires a substantive answer`);
      }
      if (!replyAddressesTopic(r, ctx)) {
        failures.push(`reply[${i}]: does not address detected intent (${ctx.primaryIntent})`);
      }
    }
  } else if (ctx.replyNeeded && ctx.primaryIntent !== "fyi_no_action") {
    for (let i = 0; i < replies.length; i++) {
      const r = replies[i]!.trim();
      if (isGenericAcknowledgmentOnly(r) && !replyAddressesTopic(r, ctx)) {
        failures.push(`reply[${i}]: too generic for ${ctx.primaryIntent}`);
      }
    }
  }

  return { ok: failures.length === 0, failures };
}
