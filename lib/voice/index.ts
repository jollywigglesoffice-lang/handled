export type { VoiceContext, VoiceLocale } from "@/lib/voice/identity";
export { VOICE_PRINCIPLES, VOICE_AVOID_PATTERNS } from "@/lib/voice/identity";

export {
  VOICE,
  voiceErrorTitle,
  voiceErrorBody,
  voiceInboxLoadError,
  voiceInboxLoadErrorTitle,
  voiceLoadingInbox,
  voiceLoadingTransition,
  voiceEmptyLine,
  voiceEmptyLines,
  voiceStressHeadline,
  voiceStressReassurance,
  voiceStressRecovery,
  voiceTryAgainLabel,
} from "@/lib/voice/copy";

export { normalizeVoiceText, voiceLintIssues, voiceCountLine } from "@/lib/voice/rules";

export {
  pickVoiceLine,
  voiceOnboardingHeadline,
  voiceOnboardingFallback,
} from "@/lib/voice/pick";
