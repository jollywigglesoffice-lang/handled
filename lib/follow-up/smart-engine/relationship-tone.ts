import type { SmartFollowUpDraftTone } from "@/lib/follow-up/smart-engine/types";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

export function followUpDraftTone(
  profile: SenderRelationshipProfile | null | undefined,
): SmartFollowUpDraftTone {
  if (!profile) {
    return {
      style: "Warm professional — supportive, brief, never pushy.",
      openerExamples: [
        "Just checking in regarding…",
        "Wanted to follow up on…",
        "Any updates when you have a moment?",
      ],
    };
  }

  switch (profile.kind) {
    case "family":
      return {
        style: "Gentle and warm — like a caring note, short sentences, no corporate tone.",
        openerExamples: [
          "Hi — just wanted to check in on…",
          "Hope you're doing well. Following up on…",
        ],
      };
    case "school":
      return {
        style: "Respectful and warm — clear, calm, appreciative of their time.",
        openerExamples: [
          "Hello — I wanted to follow up regarding…",
          "Thank you for your message about…",
        ],
      };
    case "vip_client":
    case "client":
      return {
        style:
          profile.importance === "vip"
            ? "Polished professional — attentive, concise, high competence."
            : "Professional and friendly — clear next step, no pressure.",
        openerExamples: [
          "I wanted to follow up on…",
          "Just checking whether you had a chance to review…",
        ],
      };
    case "healthcare":
      return {
        style: "Calm and considerate — no urgency language unless truly needed.",
        openerExamples: ["Following up on…", "When you have a moment, I wanted to check on…"],
      };
    default:
      return {
        style: "Supportive professional — calm executive assistant tone.",
        openerExamples: [
          "Just checking in regarding…",
          "Wanted to follow up on…",
          "Any updates when you have a moment?",
        ],
      };
  }
}
