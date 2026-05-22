import {
  mergeDimensions,
  profileForRelationship,
  PROFILE_PRESETS,
} from "@/lib/draft-memory/profiles";
import { buildStyleIndicator } from "@/lib/draft-memory/indicators";
import type {
  DraftMemoryStore,
  ResolveDraftStyleInput,
  ResolvedDraftStyle,
  StyleDimensions,
} from "@/lib/draft-memory/types";
import { EMPTY_DRAFT_MEMORY } from "@/lib/draft-memory/store-defaults";

function applyIdentityStyle(
  dims: StyleDimensions,
  identityStyle?: "professional" | "casual" | "balanced",
): StyleDimensions {
  if (!identityStyle) return dims;
  if (identityStyle === "professional") {
    return {
      ...dims,
      formality: "formal",
      directness: Math.min(100, dims.directness + 5),
    };
  }
  if (identityStyle === "casual") {
    return {
      ...dims,
      formality: "casual",
      warmth: Math.min(100, dims.warmth + 8),
    };
  }
  return dims;
}

function formatPromptBlock(
  guide: string,
  dims: StyleDimensions,
  learnedPhrases: string[],
  langs: Array<"en" | "it">,
  locale: "en" | "it",
): string {
  const phraseLine =
    learnedPhrases.length > 0
      ? locale === "it"
        ? `Frasi che usi spesso (ispirazione, non copiare alla lettera): ${learnedPhrases.slice(0, 3).join(" | ")}`
        : `Phrases you often use (inspiration, do not copy verbatim): ${learnedPhrases.slice(0, 3).join(" | ")}`
      : "";

  const langLine =
    langs.length > 1
      ? locale === "it"
        ? "L'utente mescola inglese e italiano — adatta la lingua del mittente."
        : "User mixes English and Italian — match the sender's language naturally."
      : langs[0] === "it"
        ? locale === "it"
          ? "Preferisci italiano naturale quando appropriato."
          : "Prefer natural Italian when appropriate."
        : "";

  return `Draft memory (sound like the user — never robotic labels):
- ${guide}
- Tone: ${dims.tone}; formality: ${dims.formality}; length: ${dims.sentenceLength}
- Warmth ~${dims.warmth}/100; directness ~${dims.directness}/100
${dims.greetingStyle ? `- Greeting tendency: ${dims.greetingStyle}` : ""}
${dims.signOffStyle ? `- Sign-off tendency: ${dims.signOffStyle}` : ""}
${phraseLine}
${langLine}
- These are drafts for user approval only.`.trim();
}

export function resolveDraftStyle(input: ResolveDraftStyleInput): ResolvedDraftStyle {
  const locale = input.locale ?? "en";
  const store = input.store ?? EMPTY_DRAFT_MEMORY;
  const preset = profileForRelationship(input.relationshipKind);

  let profileId = preset.id;
  const multilingualPreset = PROFILE_PRESETS.find((p) => p.id === "multilingual")!;
  const activePreset =
    store.preferredLanguages.length > 1 ? multilingualPreset : preset;

  if (store.preferredLanguages.length > 1) {
    profileId = "multilingual";
  }

  const learnedProfile = store.profiles.find((p) => p.profileId === preset.id);
  const confidence: ResolvedDraftStyle["confidence"] = learnedProfile?.editCount
    ? learnedProfile.editCount >= 2
      ? "learned"
      : "preset"
    : "preset";

  let dimensions = mergeDimensions(
    preset.dimensions,
    learnedProfile?.dimensions,
  );
  dimensions = applyIdentityStyle(dimensions, input.identityCommunicationStyle);

  const guide =
    locale === "it" ? activePreset.promptGuide.it : activePreset.promptGuide.en;

  const promptBlock = formatPromptBlock(
    guide,
    dimensions,
    learnedProfile?.learnedPhrases ?? [],
    store.preferredLanguages,
    locale,
  );

  const resolved: ResolvedDraftStyle = {
    profileId,
    dimensions,
    indicatorLabel: "",
    promptBlock,
    confidence: learnedProfile ? confidence : "default",
  };

  const indicator = buildStyleIndicator(resolved, locale);
  resolved.indicatorLabel = indicator.label;
  resolved.indicatorDetail = indicator.detail;

  return resolved;
}
