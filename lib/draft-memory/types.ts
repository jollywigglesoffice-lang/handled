import type { RelationshipKind } from "@/lib/relationship-intelligence/types";

export type CommunicationProfileId =
  | "business"
  | "personal"
  | "school"
  | "formal"
  | "multilingual"
  | "balanced";

export type StyleTone = "warm" | "neutral" | "direct";
export type StyleFormality = "casual" | "balanced" | "formal";
export type StyleSentenceLength = "concise" | "medium" | "detailed";

export type StyleDimensions = {
  tone: StyleTone;
  formality: StyleFormality;
  sentenceLength: StyleSentenceLength;
  warmth: number;
  directness: number;
  greetingStyle?: string;
  signOffStyle?: string;
};

export type LearnedStyleProfile = {
  profileId: CommunicationProfileId;
  relationshipKinds: RelationshipKind[];
  dimensions: StyleDimensions;
  learnedPhrases: string[];
  editCount: number;
  lastUpdated: number;
};

export type DraftMemoryStore = {
  version: 1;
  profiles: LearnedStyleProfile[];
  preferredLanguages: Array<"en" | "it">;
  globalHints: string[];
};

export type ResolvedDraftStyle = {
  profileId: CommunicationProfileId;
  dimensions: StyleDimensions;
  indicatorLabel: string;
  indicatorDetail?: string;
  promptBlock: string;
  confidence: "learned" | "preset" | "default";
};

export type LearnFromEditInput = {
  aiDraft: string;
  userFinal: string;
  relationshipKind?: RelationshipKind | null;
  locale?: "en" | "it";
  replyLanguage?: string;
};

export type ResolveDraftStyleInput = {
  relationshipKind?: RelationshipKind | null;
  relationshipImportance?: string;
  identityCommunicationStyle?: "professional" | "casual" | "balanced";
  locale?: "en" | "it";
  replyLanguage?: string;
  store?: DraftMemoryStore | null;
};

export type DraftMemoryIntegrationId =
  | "business_mode"
  | "personal_mode"
  | "school_mode"
  | "formal_mode"
  | "multilingual_mode";

export type DraftMemoryIntegrationDescriptor = {
  id: DraftMemoryIntegrationId;
  status: "available" | "planned" | "connected";
  description: string;
};
