/** Gmail account fields attached to every inbox message (multi-account V1). */

export type GmailAccountFields = {
  accountId: string;
  accountEmail: string;
  /** Display label, e.g. "Personal Gmail" */
  accountLabel: string;
};

export type ConnectedGmailAccount = {
  id: string;
  userId: string;
  email: string;
  label: string;
  isPrimary: boolean;
  connectedAt: string;
};

/** Composite key for per-account email storage (completions, overrides, read state). */
export function compositeEmailKey(accountId: string, emailId: string): string {
  return `${accountId}:${emailId}`;
}

export function parseCompositeEmailKey(
  key: string,
): { accountId: string; emailId: string } | null {
  const sep = key.indexOf(":");
  if (sep <= 0) return null;
  return { accountId: key.slice(0, sep), emailId: key.slice(sep + 1) };
}

export function defaultAccountLabel(email: string): string {
  const [local = "Account", domain = ""] = email.toLowerCase().split("@");
  const prettyLocal = local
    .replace(/[._]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${prettyLocal} Gmail`;
  }
  return prettyLocal || email;
}

export function accountBadgeLabel(label: string): string {
  return label.replace(/\s+Gmail$/i, "").trim() || label;
}

/** Storage key for per-account email state (completions, overrides). */
export function completionStorageKey(input: {
  emailId: string;
  accountId?: string;
}): string {
  return input.accountId
    ? compositeEmailKey(input.accountId, input.emailId)
    : input.emailId;
}

/** Compose an account-scoped storage key; raw emailId when account unknown. */
export function scopedEmailKey(emailId: string, accountId?: string | null): string {
  return accountId ? compositeEmailKey(accountId, emailId) : emailId;
}

/**
 * Look up a value in an email-keyed map: scoped key first, raw legacy key as
 * fallback (pre-multi-account data is keyed by raw Gmail message id).
 */
export function lookupScopedValue<T>(
  map: Record<string, T>,
  emailId: string,
  accountId?: string | null,
): T | undefined {
  if (accountId) {
    const scoped = map[compositeEmailKey(accountId, emailId)];
    if (scoped !== undefined) return scoped;
  }
  return map[emailId];
}

/**
 * Find the storage entry for an email id in a map whose keys may be raw ids or
 * `accountId:emailId` composites. Returns [key, value] or null.
 * Prefers exact scoped key, then raw key, then a unique `:emailId` suffix match.
 */
export function findScopedEntry<T>(
  map: Record<string, T>,
  emailId: string,
  accountId?: string | null,
): [string, T] | null {
  if (accountId) {
    const scopedKey = compositeEmailKey(accountId, emailId);
    if (map[scopedKey] !== undefined) return [scopedKey, map[scopedKey]];
  }
  if (map[emailId] !== undefined) return [emailId, map[emailId]];
  const suffix = `:${emailId}`;
  for (const key of Object.keys(map)) {
    if (key.endsWith(suffix)) return [key, map[key]];
  }
  return null;
}

export function isEmailCompleted(
  message: { id: string; accountId?: string },
  completions: Record<string, unknown>,
): boolean {
  const key = completionStorageKey({
    emailId: message.id,
    accountId: message.accountId,
  });
  return Boolean(completions[key] || completions[message.id]);
}
