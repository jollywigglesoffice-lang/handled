import { VOICE_AVOID_PATTERNS } from "@/lib/voice/identity";

/**
 * Light normalization — keeps copy on-voice without rewriting meaning.
 * Used at copy boundaries when integrating legacy strings.
 */
export function normalizeVoiceText(text: string): string {
  let out = text.trim();
  out = out.replace(/\s+/g, " ");
  out = out.replace(/^URGENT:\s*/i, "");
  out = out.replace(/!+$/g, (m) => (m.length > 1 ? "." : m));
  return out;
}

/** Dev-friendly check — returns issues found in a string. */
export function voiceLintIssues(text: string): string[] {
  const issues: string[] = [];
  for (const pattern of VOICE_AVOID_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(`Matches avoided pattern: ${pattern.source}`);
    }
  }
  if (text.length > 120 && text.split(".").length > 3) {
    issues.push("Long multi-sentence copy — prefer one idea per line.");
  }
  return issues;
}

/** Format a count without urgency framing. */
export function voiceCountLine(
  count: number,
  locale: "en" | "it",
  kind: "unread" | "attention" | "waiting",
): string {
  if (locale === "it") {
    if (kind === "unread") return `Hai ${count} email non lette.`;
    if (kind === "waiting") {
      return count === 1
        ? "1 email in attesa di risposta."
        : `${count} email in attesa di risposta.`;
    }
    return count === 1
      ? "1 email potrebbe richiedere attenzione."
      : `${count} email potrebbero richiedere attenzione.`;
  }
  if (kind === "unread") return `You have ${count} unread emails.`;
  if (kind === "waiting") {
    return count === 1
      ? "1 email waiting on a reply."
      : `${count} emails waiting on a reply.`;
  }
  return count === 1
    ? "1 email may need your attention."
    : `${count} emails may need your attention.`;
}
