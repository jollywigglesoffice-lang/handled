import { emailOverridesHeaders } from "@/lib/email-overrides/client-storage";
import { senderRelationshipsHeaders } from "@/lib/relationship-intelligence/client-storage";
import { handledBrainHeaders } from "@/lib/handled-brain/client-storage";
import { inboxRulesHeaders } from "@/lib/inbox-rules-client-storage";
import { senderPreferencesHeaders } from "@/lib/inbox-sender-preferences";
import { workflowModeHeaders } from "@/lib/workflow-mode";

/** Headers for inbox API calls: workflow mode + overrides + rules + prefs + brain. */
export function inboxFetchHeaders(): HeadersInit {
  return {
    ...workflowModeHeaders(),
    ...emailOverridesHeaders(),
    ...senderRelationshipsHeaders(),
    ...inboxRulesHeaders(),
    ...senderPreferencesHeaders(),
    ...handledBrainHeaders(),
  };
}
