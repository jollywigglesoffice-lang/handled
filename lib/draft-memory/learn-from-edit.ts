import { analyzeTextStyle, detectMixedLanguage } from "@/lib/draft-memory/analyze-text";
import {
  mergeDimensions,
  profileForRelationship,
} from "@/lib/draft-memory/profiles";
import type {
  DraftMemoryStore,
  LearnFromEditInput,
  LearnedStyleProfile,
} from "@/lib/draft-memory/types";
import { EMPTY_DRAFT_MEMORY } from "@/lib/draft-memory/store-defaults";

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function extractLearnedPhrase(userFinal: string): string | null {
  const first = userFinal.trim().split(/\n/).find((l) => l.trim().length > 12);
  if (!first || first.length > 120) return null;
  return first.trim();
}

export function learnFromEdit(
  store: DraftMemoryStore,
  input: LearnFromEditInput,
): DraftMemoryStore {
  const ai = input.aiDraft.trim();
  const user = input.userFinal.trim();
  if (!user || normalizeForCompare(ai) === normalizeForCompare(user)) {
    return store;
  }

  const preset = profileForRelationship(input.relationshipKind);
  const userStyle = analyzeTextStyle(user);
  const ratio = ai.length > 0 ? user.length / ai.length : 1;

  if (ratio < 0.72) {
    userStyle.sentenceLength = "concise";
    userStyle.directness = Math.min(100, (userStyle.directness ?? 50) + 8);
  } else if (ratio > 1.35) {
    userStyle.sentenceLength = "detailed";
    userStyle.warmth = Math.min(100, (userStyle.warmth ?? 55) + 5);
  }

  const langs = detectMixedLanguage(user);
  const nextStore: DraftMemoryStore = {
    ...store,
    preferredLanguages: [...new Set([...store.preferredLanguages, ...langs])].slice(0, 3),
  };

  let profile = nextStore.profiles.find((p) => p.profileId === preset.id);
  if (!profile) {
    profile = {
      profileId: preset.id,
      relationshipKinds: preset.relationshipKinds,
      dimensions: { ...preset.dimensions },
      learnedPhrases: [],
      editCount: 0,
      lastUpdated: Date.now(),
    };
    nextStore.profiles = [...nextStore.profiles, profile];
  }

  const phrase = extractLearnedPhrase(user);
  const learnedPhrases = phrase
    ? [...new Set([phrase, ...profile.learnedPhrases])].slice(0, 6)
    : profile.learnedPhrases;

  const updatedProfile: LearnedStyleProfile = {
    ...profile,
    dimensions: mergeDimensions(profile.dimensions, userStyle),
    learnedPhrases,
    editCount: profile.editCount + 1,
    lastUpdated: Date.now(),
  };

  return {
    ...nextStore,
    profiles: nextStore.profiles.map((p) =>
      p.profileId === preset.id ? updatedProfile : p,
    ),
  };
}

export function createEmptyStore(): DraftMemoryStore {
  return { ...EMPTY_DRAFT_MEMORY, profiles: [] };
}
