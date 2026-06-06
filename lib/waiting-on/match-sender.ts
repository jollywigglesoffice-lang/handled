import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";

/** Does this message sender match who the user is waiting on? */
export function senderMatchesWaitingTarget(
  messageSender: string,
  record: Pick<EmailCompletionRecord, "sender" | "waitingOn" | "senderDomain">,
): boolean {
  const identity = resolveSenderIdentity(messageSender);
  const waitingOn = record.waitingOn?.trim().toLowerCase();
  const original = resolveSenderIdentity(record.sender);

  if (waitingOn) {
    const hay = `${identity.displayName} ${identity.raw} ${identity.email} ${identity.domain}`.toLowerCase();
    if (hay.includes(waitingOn)) return true;
    if (identity.displayName.toLowerCase().includes(waitingOn)) return true;
    if (waitingOn.includes(identity.displayName.toLowerCase()) && identity.displayName.length > 2) {
      return true;
    }
  }

  if (identity.email && original.email && identity.email === original.email) return true;
  if (identity.ruleKey && original.ruleKey && identity.ruleKey === original.ruleKey) return true;

  if (record.senderDomain && identity.domain && record.senderDomain.toLowerCase() === identity.domain) {
    return Boolean(waitingOn || original.hasEmail);
  }

  return false;
}
