import type { ReplyContextAnalysis } from "@/lib/reply-context-analysis";
import {
  buildFullSignatureBlock,
  buildSignOffLine,
  pickSignOffForContext,
} from "@/lib/user-identity/sign-off";
import type { UserIdentity } from "@/lib/user-identity/types";
import type { WorkflowMode } from "@/lib/workflow-mode";

function communicationStyleGuidance(style: UserIdentity["communicationStyle"]): string {
  switch (style) {
    case "professional":
      return "Write with clarity and polish — confident, respectful, not stiff or robotic.";
    case "casual":
      return "Write naturally and conversationally — warm but still competent.";
    case "balanced":
    default:
      return "Write like a capable professional who sounds human — clear, warm, not corporate.";
  }
}

function adaptStyleToContext(
  identity: UserIdentity,
  ctx?: ReplyContextAnalysis | null,
  workflowMode?: WorkflowMode,
): string {
  const parts: string[] = [communicationStyleGuidance(identity.communicationStyle)];

  if (ctx?.extractedFacts.senderFirstName) {
    parts.push(
      `Recipient: ${ctx.extractedFacts.senderFirstName} — greet them by name when natural.`,
    );
  }

  if (ctx?.emailType === "inbound_sales") {
    parts.push(
      "This is a business opportunity — sound like the founder/owner, not a support bot.",
    );
    if (identity.companyName) {
      parts.push(`Represent ${identity.companyName} authentically.`);
    }
  }

  if (ctx?.emailType === "personal") {
    parts.push("Personal thread — slightly warmer, less formal signature if appropriate.");
  }

  if (workflowMode === "handle") {
    parts.push("User wants send-ready replies — complete thoughts, clear next step.");
  } else if (workflowMode === "clean") {
    parts.push("Keep replies concise.");
  }

  return parts.join(" ");
}

export function formatUserIdentityForPrompt(
  identity: UserIdentity,
  ctx?: ReplyContextAnalysis | null,
  workflowMode?: WorkflowMode,
): string {
  const display = identity.displayName.trim() || "the user";
  const lines: string[] = [
    "## Your identity (write AS this person — first person, their voice)",
    `- Display name: ${display}`,
  ];

  if (identity.fullName?.trim()) {
    lines.push(`- Full name: ${identity.fullName.trim()}`);
  }
  if (identity.businessTitle?.trim()) {
    lines.push(`- Title: ${identity.businessTitle.trim()}`);
  }
  if (identity.companyName?.trim()) {
    lines.push(`- Company: ${identity.companyName.trim()}`);
  }

  lines.push(`- Voice: ${adaptStyleToContext(identity, ctx, workflowMode)}`);

  if (identity.includeSignOffInReplies) {
    const signOff = pickSignOffForContext(identity, ctx) ?? buildSignOffLine(identity);
    const block = buildFullSignatureBlock(identity);
    if (signOff) {
      lines.push(
        `- End EVERY reply with this exact sign-off (after the message body, blank line before sign-off):\n${signOff}`,
      );
    }
    if (block && block !== signOff) {
      lines.push(
        `- For formal/sales emails you may use this full signature instead:\n${block}`,
      );
    }
  } else {
    lines.push("- Do NOT add a sign-off or signature unless the email body already includes one.");
  }

  lines.push(
    '- Never write as an AI assistant. Never say "I am an AI" or "as an assistant".',
  );

  return lines.join("\n");
}

export function resolveReplyAuthorName(identity: UserIdentity, legacyUserName?: string): string {
  return identity.displayName.trim() || legacyUserName?.trim() || "";
}
