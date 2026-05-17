import { mergeInboxUserRules } from "@/lib/merge-inbox-rules";
import { loadInboxUserRulesForUser } from "@/lib/inbox-user-rules";
import { parseInboxRulesHeader } from "@/lib/inbox-rules-client-storage";
import {
  parseSenderPreferencesHeader,
  senderPreferencesToRules,
} from "@/lib/inbox-sender-preferences";
import { loadSenderPreferencesForUser } from "@/lib/inbox-sender-preferences-store";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export async function loadCategorizationRulesForUser(
  userId: string,
  request?: Request,
): Promise<InboxUserRule[]> {
  const [serverRules, senderPrefs] = await Promise.all([
    loadInboxUserRulesForUser(userId),
    loadSenderPreferencesForUser(userId),
  ]);

  const clientRules = request
    ? parseInboxRulesHeader(request.headers.get("x-handled-inbox-rules"))
    : [];
  const clientPrefs = request
    ? parseSenderPreferencesHeader(request.headers.get("x-handled-sender-preferences"))
    : [];

  const learnedRules = senderPreferencesToRules([...senderPrefs, ...clientPrefs]);
  return mergeInboxUserRules(mergeInboxUserRules(serverRules, learnedRules), clientRules);
}
