import type { EmotionalTrajectory } from "@/lib/timeline-intelligence/types";

const FRUSTRATED =
  /\b(frustrat|disappoint|unacceptable|still (?:waiting|no response)|not acceptable|terzo sollecito|insoddisfatt)\b/i;

const URGENT =
  /\b(urgent|asap|immediately|right away|deadline tomorrow|subito|urgente)\b/i;

const ACTIONABLE =
  /\b(please (?:confirm|approve|review|send)|action required|need your (?:reply|response|approval)|decision needed)\b/i;

const INFORMATIONAL =
  /\b(fyi|for your (?:info|reference)|no action needed|just (?:wanted to )?let you know|heads up)\b/i;

const ESCALATING =
  /\b(following up again|second reminder|third reminder|final reminder|still waiting)\b/i;

export function detectEmotionalTrajectory(
  hay: string,
  escalationScore: number,
): EmotionalTrajectory {
  if (ESCALATING.test(hay) || escalationScore >= 40) return "escalating";
  if (FRUSTRATED.test(hay)) return "frustrated";
  if (URGENT.test(hay)) return "urgent";
  if (ACTIONABLE.test(hay)) return "actionable";
  if (INFORMATIONAL.test(hay) && !ACTIONABLE.test(hay)) return "informational";
  return "calm";
}

export function trajectoryAdaptationHint(trajectory: EmotionalTrajectory): string {
  switch (trajectory) {
    case "frustrated":
      return "Acknowledge their patience; be direct and reassuring — no deflection.";
    case "urgent":
    case "escalating":
      return "Respond with clarity and a concrete next step; avoid vague acknowledgments.";
    case "actionable":
      return "Address the specific ask; confirm what you will do.";
    case "informational":
      return "Brief acknowledgment is enough unless they asked a question.";
    default:
      return "Warm, calm tone — match their pace without adding pressure.";
  }
}
