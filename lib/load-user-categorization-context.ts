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
import { buildInboxCategoryCatalog } from "@/lib/inbox-category-catalog";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { parsePersonalCategoriesHeader } from "@/lib/personal-categories/client-storage";
import { loadPersonalCategoriesForUser } from "@/lib/personal-categories/store";
import type { PersonalInboxCategory } from "@/lib/personal-categories/types";
import { loadSenderRulesForUser } from "@/lib/sender-rules/store";
import { isLearnedSenderInboxRule, senderRulesToInboxRules } from "@/lib/sender-rules/to-inbox-rules";
import { parseSenderRelationshipsHeader } from "@/lib/relationship-intelligence/client-storage";
import { loadSenderRelationshipsForUser } from "@/lib/relationship-intelligence/store";
import type { SenderRelationship } from "@/lib/relationship-intelligence/types";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import type { MemoryEngineSnapshot } from "@/lib/memory-engine/types";
import { memoryRulesFromSnapshot } from "@/lib/memory-engine/apply";
import { loadMemoryEngineForUser } from "@/lib/memory-engine/store";
import { safeArray } from "@/lib/safe-array";

export type CategorizationContext = {
  /** Per-email manual overrides — highest priority. */
  emailOverrides: Record<string, InboxAiCategory>;
  emailOverrideRecords: EmailCategoryOverride[];
  /** Behavioral memory rules — outrank sender prefs after repeated corrections. */
  memoryRules: InboxUserRule[];
  memorySnapshot: MemoryEngineSnapshot;
  /** Learned per-sender rules — applied before keyword rules and AI. */
  senderRules: InboxUserRule[];
  /** Keyword / manual inbox rules — applied after sender rules. */
  keywordRules: InboxUserRule[];
  /** Combined for legacy callers (sender first by priority). */
  allRules: InboxUserRule[];
  /** Learned + manual sender relationships. */
  senderRelationships: SenderRelationship[];
  personalCategories: PersonalInboxCategory[];
  categoryCatalog: ReturnType<typeof buildInboxCategoryCatalog>;
};

function stripLearnedSenderDuplicates(rules: InboxUserRule[] | null | undefined): InboxUserRule[] {
  return safeArray(rules).filter((r) => !isLearnedSenderInboxRule(r));
}

export async function loadCategorizationContext(
  userId: string,
  request?: Request,
): Promise<CategorizationContext> {
  const [serverKeywordRules, senderRulesFromDb, serverOverrides, serverRelationships, memorySnapshot] =
    await Promise.all([
      loadInboxUserRulesForUser(userId),
      loadSenderRulesForUser(userId),
      loadEmailOverridesForUser(userId),
      loadSenderRelationshipsForUser(userId),
      loadMemoryEngineForUser(userId),
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

  const memoryRules = memoryRulesFromSnapshot(memorySnapshot);
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
  for (const r of safeArray(clientRelationships)) {
    const key = r.senderEmail || r.senderDomain;
    if (key) relByKey.set(key, r);
  }
  for (const r of safeArray(serverRelationships)) {
    const key = r.senderEmail || r.senderDomain;
    if (key) relByKey.set(key, r);
  }
  const senderRelationships = [...relByKey.values()];

  const clientPersonal = request
    ? parsePersonalCategoriesHeader(
        request.headers.get("x-handled-personal-categories"),
      )
    : [];
  const serverPersonal = await loadPersonalCategoriesForUser(userId);
  const personalCategories =
    safeArray(clientPersonal).length > 0 ? clientPersonal : safeArray(serverPersonal);
  const categoryCatalog = buildInboxCategoryCatalog(personalCategories);

  return {
    emailOverrides,
    emailOverrideRecords,
    memoryRules,
    memorySnapshot,
    senderRules: mergedSender,
    keywordRules,
    allRules,
    senderRelationships,
    personalCategories,
    categoryCatalog,
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
