import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import { emailOverridesHeaders } from "@/lib/email-overrides/client-storage";
import { senderRelationshipsHeaders } from "@/lib/relationship-intelligence/client-storage";
import { handledBrainHeaders } from "@/lib/handled-brain/client-storage";
import { inboxRulesHeaders } from "@/lib/inbox-rules-client-storage";
import { senderPreferencesHeaders } from "@/lib/inbox-sender-preferences";
import { completionActionsHeaders } from "@/lib/completion-actions/client-storage";
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
    ...completionActionsHeaders(),
  };
}

/**
 * Auth + workflow only — avoids HTTP 431 from bulky localStorage sync headers.
 * Use for inbox load, search, and single-message detail fetches.
 */
export async function inboxLoadFetchHeaders(): Promise<HeadersInit> {
  return protectedApiHeaders(workflowModeHeaders());
}

/** Auth + inbox preference headers for protected /api/* calls. */
export async function inboxFetchHeaders(): Promise<HeadersInit> {
  return protectedApiHeaders(inboxPreferenceHeaders());
}
