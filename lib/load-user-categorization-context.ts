import { parseEmailOverridesHeader } from "@/lib/email-overrides/client-storage";
import { loadEmailOverridesForUser } from "@/lib/email-overrides/store";
import { mergeEmailOverrides, overridesToCategoryMap } from "@/lib/email-overrides/storage";
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
import { parseSenderRelationshipsHeader } from "@/lib/relationship-intelligence/client-storage";
import { loadSenderRelationshipsForUser } from "@/lib/relationship-intelligence/store";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
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
  /** Learned + manual sender relationships. */
  senderRelationships: SenderRelationship[];
};

function stripLearnedSenderDuplicates(rules: InboxUserRule[]): InboxUserRule[] {
  return rules.filter((r) => !isLearnedSenderInboxRule(r));
}

export async function loadCategorizationContext(
  userId: string,
  request?: Request,
): Promise<CategorizationContext> {
  const [serverKeywordRules, senderRulesFromDb, serverOverrides, serverRelationships] =
    await Promise.all([
      loadInboxUserRulesForUser(userId),
      loadSenderRulesForUser(userId),
      loadEmailOverridesForUser(userId),
      loadSenderRelationshipsForUser(userId),
    ]);

  const clientOverrides = request
    ? parseEmailOverridesHeader(request.headers.get("x-handled-email-overrides"))
    : [];
  const emailOverrideRecords = mergeEmailOverrides(clientOverrides, serverOverrides);
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

  const clientRelationships = request
    ? parseSenderRelationshipsHeader(request.headers.get("x-handled-sender-relationships"))
    : [];
  const relByKey = new Map<string, SenderRelationship>();
  for (const r of clientRelationships) {
    const key = r.senderEmail || r.senderDomain;
    if (key) relByKey.set(key, r);
  }
  for (const r of serverRelationships) {
    const key = r.senderEmail || r.senderDomain;
    if (key) relByKey.set(key, r);
  }
  const senderRelationships = [...relByKey.values()];

  return {
    emailOverrides,
    emailOverrideRecords,
    senderRules: mergedSender,
    keywordRules,
    allRules,
    senderRelationships,
  };
}

/** @deprecated use loadCategorizationContext */
export async function loadCategorizationRulesForUser(
  userId: string,
  request?: Request,
): Promise<InboxUserRule[]> {
  const ctx = await loadCategorizationContext(userId, request);
  return ctx.allRules;
}
