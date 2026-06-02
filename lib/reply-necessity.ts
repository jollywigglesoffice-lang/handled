import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { analyzeEmailIntent, requiresHumanReply } from "@/lib/email-intent";
import {
  hasUrgentHumanSignal,
  isCommercialBulk,
  isTransactionalFyi,
} from "@/lib/inbox-triage-signals";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";

export type ReplyNeedAssessment = {
  recommended: boolean;
  reason: string;
  suggestedAction: string;
  confidence: number;
};

function modeSuppressesReplies(mode: WorkflowMode, category: InboxAiCategory): boolean {
  const profile = getWorkflowModeProfile(mode);
  if (!profile.showReplySection) {
    return category !== "needs_attention";
  }
  if (profile.hidePromotionsInList && (category === "promotion" || category === "newsletter")) {
    return true;
  }
  return false;
}

/**
 * Should Handled offer reply drafts for this message?
 * Promotional / FYI mail should not get "Got it, thanks!" suggestions.
 */
export function assessReplyNeed(input: {
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">;
  category: InboxAiCategory;
  workflowMode?: WorkflowMode;
}): ReplyNeedAssessment {
  const { row, category, workflowMode = "assist" } = input;
  const subject = (row.subject ?? "").trim();
  const rowForSignals = row as GmailInboxRow;
  const intent = analyzeEmailIntent(rowForSignals);

  if (intent.requiresReply || requiresHumanReply(rowForSignals)) {
    const action =
      intent.opportunityHint ??
      (intent.kinds.includes("pricing_inquiry")
        ? "Review pricing question and reply with details."
        : "Review and reply when ready.");
    const who = row.sender.split("<")[0]?.trim() || "They";
    return {
      recommended: true,
      reason:
        intent.kinds.includes("pricing_inquiry")
          ? `${who} is asking about pricing — they expect an answer.`
          : intent.kinds.includes("sales_lead")
            ? `${who} reached out with business interest.`
            : `${who} asked something that needs a response.`,
      suggestedAction: action,
      confidence: Math.max(0.85, intent.confidence),
    };
  }

  if (category === "promotion") {
    return {
      recommended: false,
      reason: "Promotional email — nothing you need to send back.",
      suggestedAction: "Archive when you're done skimming.",
      confidence: 0.92,
    };
  }

  if (category === "newsletter") {
    return {
      recommended: false,
      reason: "Newsletter or digest — read when you want.",
      suggestedAction: "Read later or archive.",
      confidence: 0.9,
    };
  }

  if (category === "fyi") {
    return {
      recommended: false,
      reason: "Confirmation or update — important to see, but nothing to send back.",
      suggestedAction: "Skim and file — no reply needed.",
      confidence: 0.9,
    };
  }

  if (category === "handled") {
    if (isTransactionalFyi(rowForSignals) && !hasUrgentHumanSignal(rowForSignals)) {
      return {
        recommended: false,
        reason: "Receipt, notification, or automated update.",
        suggestedAction: "File or archive — no reply needed.",
        confidence: 0.88,
      };
    }
  }

  if (isCommercialBulk(rowForSignals) && !hasUrgentHumanSignal(rowForSignals)) {
    const social =
      /instagram|facebook|linkedin|tiktok|twitter|notification/i.test(
        `${row.sender} ${subject} ${row.snippet ?? ""}`,
      );
    return {
      recommended: false,
      reason: social
        ? "Social notification — not a conversation."
        : "Automated or promotional content.",
      suggestedAction: "Safe to archive.",
      confidence: 0.85,
    };
  }

  if (modeSuppressesReplies(workflowMode, category)) {
    return {
      recommended: false,
      reason:
        workflowMode === "clean"
          ? "Clean mode hides replies for low-priority mail."
          : "Handle mode focuses on important threads only.",
      suggestedAction: "Archive or skim — reply optional.",
      confidence: 0.75,
    };
  }

  if (category === "quick_reply" && hasUrgentHumanSignal(rowForSignals)) {
    return {
      recommended: true,
      reason: "Short message that may need a quick acknowledgment.",
      suggestedAction: "A brief reply may help.",
      confidence: 0.7,
    };
  }

  if (category === "needs_attention" || hasUrgentHumanSignal(rowForSignals)) {
    return {
      recommended: true,
      reason: "They're waiting to hear from you.",
      suggestedAction: "Send a reply when you're ready.",
      confidence: 0.8,
    };
  }

  if (category === "quick_reply") {
    return {
      recommended: true,
      reason: "May benefit from a short reply.",
      suggestedAction: "Optional quick response.",
      confidence: 0.55,
    };
  }

  if (hasUrgentHumanSignal(rowForSignals)) {
    return {
      recommended: true,
      reason: "May need a response.",
      suggestedAction: "Review and reply if appropriate.",
      confidence: 0.55,
    };
  }

  return {
    recommended: false,
    reason: "No clear need to respond.",
    suggestedAction: "No action required.",
    confidence: 0.6,
  };
}
