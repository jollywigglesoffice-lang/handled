import { parseEmailOverridesHeader } from "@/lib/email-overrides/client-storage";
import { loadEmailOverridesForUser } from "@/lib/email-overrides/store";
import { overridesToCategoryMap } from "@/lib/email-overrides/storage";
import type { EmailCategoryOverride } from "@/lib/email-overrides/types";
import { mergeInboxUserRules } from "@/lib/merge-inbox-rules";
import { loadInboxUserRulesForUser } from "@/lib/inbox-user-rules";
import { parseInboxRulesHeader } from "@/lib/inbox-rules-client-storage";
import {
  parseSenderPreferencesHeader,
  senderPreferencesToRules,
} from "@/lib/inbox-sender-preferences";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { loadSenderRulesForUser } from "@/lib/sender-rules/store";
import { isLearnedSenderInboxRule, senderRulesToInboxRules } from "@/lib/sender-rules/to-inbox-rules";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type CategorizationContext = {
  /** Per-email manual overrides — highest priority. */
  emailOverrides: Record<string, InboxAiCategory>;
  emailOverrideRecords: EmailCategoryOverride[];
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
  const [serverKeywordRules, senderRulesFromDb, serverOverrides] = await Promise.all([
    loadInboxUserRulesForUser(userId),
    loadSenderRulesForUser(userId),
    loadEmailOverridesForUser(userId),
  ]);

  const clientOverrides = request
    ? parseEmailOverridesHeader(request.headers.get("x-handled-email-overrides"))
    : [];
  const overrideById = new Map<string, EmailCategoryOverride>();
  for (const o of clientOverrides) overrideById.set(o.emailId, o);
  for (const o of serverOverrides) overrideById.set(o.emailId, o);
  const emailOverrideRecords = [...overrideById.values()];
  const emailOverrides = overridesToCategoryMap(emailOverrideRecords);

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

  return { emailOverrides, emailOverrideRecords, senderRules: mergedSender, keywordRules, allRules };
}

/** @deprecated use loadCategorizationContext */
export async function loadCategorizationRulesForUser(
  userId: string,
  request?: Request,
): Promise<InboxUserRule[]> {
  const ctx = await loadCategorizationContext(userId, request);
  return ctx.allRules;
}
