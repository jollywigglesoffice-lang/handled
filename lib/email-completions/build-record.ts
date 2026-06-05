import {
  buildWaitingActionLabel,
  computeFollowUpAt,
} from "@/lib/waiting-on/helpers";
import type { CompleteEmailInput, EmailCompletionRecord } from "@/lib/email-completions/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";

export function buildEmailCompletionRecord(
  input: CompleteEmailInput,
  completedAt: number,
  locale: "en" | "it" = "en",
): EmailCompletionRecord {
  const domain = resolveSenderIdentity(input.sender).domain ?? undefined;
  const waitingOn = input.waitingOn?.trim() || undefined;
  const followUpAfterDays =
    input.followUpAfterDays && input.followUpAfterDays > 0
      ? input.followUpAfterDays
      : undefined;

  let actionLabel = input.actionLabel;
  if (input.actionId === "waiting_on_someone") {
    actionLabel = buildWaitingActionLabel(waitingOn, locale);
  }

  return {
    emailId: input.emailId,
    actionId: input.actionId,
    actionLabel,
    completedAt,
    sender: input.sender,
    subject: input.subject,
    snippet: input.snippet,
    category: input.category,
    senderDomain: domain,
    waitingOn,
    followUpAfterDays,
    followUpAt: computeFollowUpAt(completedAt, followUpAfterDays),
  };
}

export function mergeWaitingFieldsFromRaw(
  record: EmailCompletionRecord,
  raw: Record<string, unknown>,
): EmailCompletionRecord {
  return {
    ...record,
    waitingOn: typeof raw.waitingOn === "string" ? raw.waitingOn : record.waitingOn,
    followUpAfterDays:
      typeof raw.followUpAfterDays === "number"
        ? raw.followUpAfterDays
        : record.followUpAfterDays,
    followUpAt: typeof raw.followUpAt === "number" ? raw.followUpAt : record.followUpAt,
    waitingResolvedAt:
      typeof raw.waitingResolvedAt === "number"
        ? raw.waitingResolvedAt
        : record.waitingResolvedAt,
    stillWaitingAt:
      typeof raw.stillWaitingAt === "number" ? raw.stillWaitingAt : record.stillWaitingAt,
  };
}
