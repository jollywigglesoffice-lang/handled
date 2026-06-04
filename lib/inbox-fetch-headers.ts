import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import { emailOverridesHeaders } from "@/lib/email-overrides/client-storage";
import { senderRelationshipsHeaders } from "@/lib/relationship-intelligence/client-storage";
import { handledBrainHeaders } from "@/lib/handled-brain/client-storage";
import { inboxRulesHeaders } from "@/lib/inbox-rules-client-storage";
import { senderPreferencesHeaders } from "@/lib/inbox-sender-preferences";
import { personalCategoriesHeaders } from "@/lib/personal-categories/client-storage";
import { workflowModeHeaders } from "@/lib/workflow-mode";

/** Sync inbox preference headers (no auth). */
export function inboxPreferenceHeaders(): HeadersInit {
  return {
    ...workflowModeHeaders(),
    ...emailOverridesHeaders(),
    ...senderRelationshipsHeaders(),
    ...inboxRulesHeaders(),
    ...senderPreferencesHeaders(),
    ...handledBrainHeaders(),
    ...personalCategoriesHeaders(),
  };
}

/** Auth + inbox preference headers for protected /api/* calls. */
export async function inboxFetchHeaders(): Promise<HeadersInit> {
  return protectedApiHeaders(inboxPreferenceHeaders());
}
