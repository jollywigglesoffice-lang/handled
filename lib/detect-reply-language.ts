import { franc } from "franc-min";
import type { ReplyLanguage } from "@/app/user-preferences-context";

const FRANC_ONLY = ["eng", "ita", "spa", "fra", "deu"] as const;

const FRANC_TO_REPLY: Record<(typeof FRANC_ONLY)[number], ReplyLanguage> = {
  eng: "english",
  ita: "italian",
  spa: "spanish",
  fra: "french",
  deu: "german",
};

/**
 * Guess which supported reply language matches the email body.
 * Runs synchronously (franc-min); safe on server and client.
 */
export function detectReplyLanguageFromEmail(
  text: string,
  fallback: ReplyLanguage = "english",
): ReplyLanguage {
  const sample = text.trim().slice(0, 2048);
  if (sample.length < 3) {
    return fallback;
  }

  const code = franc(sample, {
    minLength: 3,
    only: [...FRANC_ONLY],
  });

  if (code === "und") {
    return fallback;
  }

  return FRANC_TO_REPLY[code as keyof typeof FRANC_TO_REPLY] ?? fallback;
}
