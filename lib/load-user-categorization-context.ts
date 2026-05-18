import { mergeInboxUserRules } from "@/lib/merge-inbox-rules";
import { loadInboxUserRulesForUser } from "@/lib/inbox-user-rules";
import { parseInboxRulesHeader } from "@/lib/inbox-rules-client-storage";
import {
  parseSenderPreferencesHeader,
  senderPreferencesToRules,
} from "@/lib/inbox-sender-preferences";
import { loadSenderRulesForUser } from "@/lib/sender-rules/store";
import { isLearnedSenderInboxRule, senderRulesToInboxRules } from "@/lib/sender-rules/to-inbox-rules";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type CategorizationContext = {
  /** Learned per-sender rules — applied before keyword rules and AI. */
  senderRules: InboxUserRule[];
  /** Keyword / manual inbox rules — applied after sender rules. */
  keywordRules: InboxUserRule[];
  /** Combined for legacy callers (sender first by priority). */
  allRules: InboxUserRule[];
};

function stripLearnedSenderDuplicates(rules: InboxUserRule[]): InboxUserRule[] {
  return rules.filter((r) => !isLearnedSenderInboxRule(r));
}

export async function loadCategorizationContext(
  userId: string,
  request?: Request,
): Promise<CategorizationContext> {
  const [serverKeywordRules, senderRulesFromDb] = await Promise.all([
    loadInboxUserRulesForUser(userId),
    loadSenderRulesForUser(userId),
  ]);

  const clientRules = request
    ? parseInboxRulesHeader(request.headers.get("x-handled-inbox-rules"))
    : [];
  const clientPrefs = request
    ? parseSenderPreferencesHeader(request.headers.get("x-handled-sender-preferences"))
    : [];

  const senderRules = senderRulesToInboxRules(senderRulesFromDb);
  const clientSenderRules = senderPreferencesToRules(clientPrefs);

  const keywordRules = mergeInboxUserRules(
    stripLearnedSenderDuplicates(serverKeywordRules),
    stripLearnedSenderDuplicates(clientRules),
  );

  const mergedSender = mergeInboxUserRules(senderRules, clientSenderRules);
  const allRules = mergeInboxUserRules(mergedSender, keywordRules);

  return { senderRules: mergedSender, keywordRules, allRules };
}

/** @deprecated use loadCategorizationContext */
export async function loadCategorizationRulesForUser(
  userId: string,
  request?: Request,
): Promise<InboxUserRule[]> {
  const ctx = await loadCategorizationContext(userId, request);
  return ctx.allRules;
}
