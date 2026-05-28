import { parseSenderDomain, parseSenderEmail } from "@/lib/inbox-user-rules/match";

export type SenderIdentity = {
  /** Value stored on inbox rows (display + email when available). */
  raw: string;
  displayName: string;
  email: string;
  domain: string;
  /** Stable key for rules — email preferred, else normalized display name. */
  ruleKey: string;
  hasEmail: boolean;
};

const DEBUG =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_SENDER_RULE_DEBUG === "1");

export function logSenderRuleDebug(phase: string, payload: Record<string, unknown>): void {
  if (!DEBUG) return;
  console.log(`[sender-rule] ${phase}`, payload);
}

/**
 * Normalize a Gmail From header or inbox `sender` line into a stable identity.
 */
export function resolveSenderIdentity(senderLine: string | undefined | null): SenderIdentity {
  const raw = (senderLine ?? "").trim();
  const email = parseSenderEmail(raw).toLowerCase();
  const domain = parseSenderDomain(raw).toLowerCase();

  const displayMatch = raw.match(/^"?([^"<]+)"?\s*</);
  let displayName = displayMatch?.[1]?.trim() ?? "";
  if (!displayName && email) {
    displayName = email.split("@")[0] ?? "";
  }
  if (!displayName && raw && !raw.includes("@")) {
    displayName = raw;
  }

  const ruleKey = email || displayName.trim().toLowerCase();

  return {
    raw,
    displayName,
    email,
    domain,
    ruleKey,
    hasEmail: Boolean(email),
  };
}

/** Format Gmail From header for inbox storage — always include email when present. */
export function formatGmailSender(fromHeader: string): string {
  if (!fromHeader?.trim()) return "Unknown sender";
  const identity = resolveSenderIdentity(fromHeader);
  if (identity.displayName && identity.email) {
    return `${identity.displayName} <${identity.email}>`;
  }
  if (identity.email) return identity.email;
  if (identity.displayName) return identity.displayName;
  return fromHeader.trim();
}

export function senderIdentityForTeachHandled(input: {
  emailId?: string;
  sender: string;
  subject?: string;
  scope?: string;
  category?: string;
}): Record<string, unknown> {
  const identity = resolveSenderIdentity(input.sender);
  return {
    emailId: input.emailId,
    subject: input.subject?.slice(0, 80),
    scope: input.scope,
    category: input.category,
    senderRaw: identity.raw,
    senderEmail: identity.email || null,
    senderDomain: identity.domain || null,
    senderDisplayName: identity.displayName || null,
    normalizedSender: identity.ruleKey || null,
    hasEmail: identity.hasEmail,
  };
}
