import type { RelationshipKind } from "@/lib/relationship-intelligence/types";
import type {
  CommunicationProfileId,
  StyleDimensions,
} from "@/lib/draft-memory/types";

export type ProfilePreset = {
  id: CommunicationProfileId;
  relationshipKinds: RelationshipKind[];
  dimensions: StyleDimensions;
  promptGuide: { en: string; it: string };
};

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: "school",
    relationshipKinds: ["school"],
    dimensions: {
      tone: "warm",
      formality: "balanced",
      sentenceLength: "concise",
      warmth: 78,
      directness: 45,
      greetingStyle: "Hello / Thank you",
    },
    promptGuide: {
      en: "Respectful and warm — clear, calm, appreciative of their time. Short sentences.",
      it: "Rispettoso e cordiale — chiaro, calmo, grato per il loro tempo. Frasi brevi.",
    },
  },
  {
    id: "personal",
    relationshipKinds: ["family", "friends"],
    dimensions: {
      tone: "warm",
      formality: "casual",
      sentenceLength: "medium",
      warmth: 85,
      directness: 40,
      greetingStyle: "Hi / Hey",
    },
    promptGuide: {
      en: "Warm and natural — like a real note to someone you know. Relaxed, not corporate.",
      it: "Caldo e naturale — come un messaggio a qualcuno che conosci. Rilassato, non corporate.",
    },
  },
  {
    id: "business",
    relationshipKinds: ["vip_client", "client", "team", "billing"],
    dimensions: {
      tone: "neutral",
      formality: "formal",
      sentenceLength: "medium",
      warmth: 55,
      directness: 65,
      greetingStyle: "Hello / Hi",
    },
    promptGuide: {
      en: "Professional and structured — competent, concise, clear next step when needed.",
      it: "Professionale e strutturato — competente, conciso, passo successivo chiaro se serve.",
    },
  },
  {
    id: "formal",
    relationshipKinds: ["healthcare"],
    dimensions: {
      tone: "neutral",
      formality: "formal",
      sentenceLength: "concise",
      warmth: 50,
      directness: 50,
    },
    promptGuide: {
      en: "Calm and considerate — no casual slang, no false urgency.",
      it: "Calmo e attento — niente slang, niente urgenza artificiale.",
    },
  },
  {
    id: "multilingual",
    relationshipKinds: [],
    dimensions: {
      tone: "warm",
      formality: "balanced",
      sentenceLength: "medium",
      warmth: 65,
      directness: 50,
    },
    promptGuide: {
      en: "Match the sender's language naturally — English and Italian may mix. Sound human, not translated.",
      it: "Adatta la lingua del mittente — inglese e italiano possono mescolarsi. Suona umano, non tradotto.",
    },
  },
  {
    id: "balanced",
    relationshipKinds: ["unknown", "newsletter", "promotion", "marketing"],
    dimensions: {
      tone: "neutral",
      formality: "balanced",
      sentenceLength: "medium",
      warmth: 60,
      directness: 55,
    },
    promptGuide: {
      en: "Balanced professional — friendly but not overly familiar.",
      it: "Professionale equilibrato — cordiale ma non troppo familiare.",
    },
  },
];

export function profileForRelationship(
  kind?: RelationshipKind | null,
): ProfilePreset {
  if (!kind) return PROFILE_PRESETS.find((p) => p.id === "balanced")!;
  const match = PROFILE_PRESETS.find((p) => p.relationshipKinds.includes(kind));
  return match ?? PROFILE_PRESETS.find((p) => p.id === "balanced")!;
}

export function mergeDimensions(
  base: StyleDimensions,
  learned?: Partial<StyleDimensions>,
): StyleDimensions {
  if (!learned) return base;
  return {
    ...base,
    ...learned,
    warmth: learned.warmth ?? base.warmth,
    directness: learned.directness ?? base.directness,
  };
}
