/**
 * Handled Voice Identity
 *
 * A calm, consistent presence — never urgent, never verbose, never corrective.
 * All user-facing copy should follow these principles or flow through lib/voice/copy.
 */

export type VoiceLocale = "en" | "it";

/** Subtle tone shift — same personality, never a different character. */
export type VoiceContext =
  | "normal"
  | "stress"
  | "empty"
  | "loading"
  | "error"
  | "onboarding"
  | "success";

export const VOICE_PRINCIPLES = {
  calm: "Never urgent. State facts plainly.",
  minimal: "Short sentences. One idea per line.",
  supportive: "Guide softly. Never blame or correct the user.",
  understated: "Intelligent but quiet — no hype, no AI theater.",
  steady: "Same emotional register in stress, errors, and loading.",
} as const;

/** Phrasing patterns to avoid in user-facing copy. */
export const VOICE_AVOID_PATTERNS = [
  /\b(urgent|URGENT|asap|don't miss|do not miss|you must|act now|immediately)\b/i,
  /\b(revolutionary|powerful AI|game.?changer|supercharge|optimize workflow|utilize)\b/i,
  /\b(failed|failure|error occurred|invalid|forbidden)\b/i,
] as const;
