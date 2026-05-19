import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";
import type {
  RelationshipKind,
  SenderRelationshipProfile,
} from "@/lib/relationship-intelligence/types";

/** Never hide family/school/healthcare/vip in clean/handle modes. */
export function shouldShowDespiteWorkflowHide(
  profile: SenderRelationshipProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.importance === "vip" || profile.importance === "important") return true;
  return ["family", "school", "healthcare", "vip_client"].includes(profile.kind);
}

export function shouldHideForRelationship(
  profile: SenderRelationshipProfile | null | undefined,
  category: InboxAiCategory,
  mode: WorkflowMode,
): boolean {
  if (!profile) return false;
  if (shouldShowDespiteWorkflowHide(profile)) return false;
  if (profile.importance === "ignore") return true;
  const profileMode = getWorkflowModeProfile(mode);
  if (!profileMode.hidePromotionsInList) return false;
  return (
    profile.kind === "newsletter" ||
    profile.kind === "promotion" ||
    profile.kind === "marketing" ||
    category === "newsletter" ||
    category === "promotion"
  );
}

export function applyRelationshipToCategory(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
  profile: SenderRelationshipProfile | null | undefined,
): InboxAiCategory {
  if (!profile) return category;

  if (profile.importance === "ignore") {
    if (category !== "needs_attention") return "handled";
  }

  if (profile.importance === "vip" || profile.kind === "vip_client") {
    if (category === "handled" || category === "promotion" || category === "newsletter") {
      return "needs_attention";
    }
  }

  if (profile.kind === "family" || profile.kind === "school" || profile.kind === "healthcare") {
    if (category === "promotion" || category === "newsletter") {
      return "needs_attention";
    }
    if (category === "handled") {
      return "quick_reply";
    }
  }

  if (profile.kind === "team" && category === "handled") {
    return "quick_reply";
  }

  return category;
}

export function relationshipReplyDirective(
  profile: SenderRelationshipProfile | null | undefined,
): string {
  if (!profile) return "";

  const byKind: Partial<Record<RelationshipKind, string>> = {
    family:
      "Relationship: family — use a warmer, shorter tone. Be thoughtful and human, not corporate.",
    friends:
      "Relationship: friend — casual and warm. Short sentences, natural phrasing.",
    school:
      "Relationship: school — respectful and clear. Parents/teachers appreciate concise, calm replies.",
    healthcare:
      "Relationship: healthcare — calm, clear, and considerate. No marketing tone.",
    vip_client:
      "Relationship: VIP client — polished, professional, structured. Show attentiveness and competence.",
    client:
      "Relationship: client — professional and helpful. Clear next steps.",
    team: "Relationship: teammate — collaborative, direct, friendly-professional.",
    billing:
      "Relationship: billing — factual and brief unless they asked a question.",
    newsletter:
      "Relationship: newsletter — only reply if they asked something; otherwise minimal.",
    promotion: "Relationship: promotional — do not sound eager; brief or skip reply.",
    marketing: "Relationship: marketing — neutral, brief.",
  };

  const line = byKind[profile.kind];
  if (profile.importance === "vip") {
    return `${line ?? ""}\nTreat as high-priority VIP — never generic acknowledgment only.`.trim();
  }
  return line ?? "";
}

export function relationshipFollowUpHeadline(
  profile: SenderRelationshipProfile | null | undefined,
  baseHeadline: string,
  baseCalmPrompt: string,
): { headline: string; calmPrompt: string } {
  if (!profile) return { headline: baseHeadline, calmPrompt: baseCalmPrompt };

  if (profile.kind === "school") {
    return {
      headline: baseHeadline.replace(/^/, "").startsWith("Teacher")
        ? baseHeadline
        : `School: ${baseHeadline}`,
      calmPrompt: baseCalmPrompt,
    };
  }

  if (profile.importance === "vip" || profile.kind === "vip_client") {
    return {
      headline: `VIP client — ${baseHeadline.charAt(0).toLowerCase()}${baseHeadline.slice(1)}`,
      calmPrompt: `${baseCalmPrompt} Handled is keeping this relationship visible.`,
    };
  }

  if (profile.kind === "family") {
    return {
      headline: baseHeadline,
      calmPrompt: `${baseCalmPrompt} Take your time — family comes first.`,
    };
  }

  if (profile.kind === "healthcare") {
    return {
      headline: `Healthcare — ${baseHeadline}`,
      calmPrompt: baseCalmPrompt,
    };
  }

  return { headline: baseHeadline, calmPrompt: baseCalmPrompt };
}

export function relationshipUrgencyBoost(
  profile: SenderRelationshipProfile | null | undefined,
): number {
  if (!profile) return 0;
  if (profile.importance === "vip") return 18;
  if (profile.kind === "family" || profile.kind === "school") return 12;
  if (profile.kind === "healthcare") return 10;
  if (profile.importance === "important") return 8;
  if (profile.importance === "ignore") return -25;
  return 0;
}
