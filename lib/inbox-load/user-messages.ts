import type { InboxLoadFailureReason } from "@/lib/inbox-load/types";
import {
  calmInboxLoadErrorMessage,
  type CalmSystemLocale,
} from "@/lib/calm-system-copy";
import type { UiLocale } from "@/lib/ui-copy";

export function inboxLoadUserMessage(
  reason: InboxLoadFailureReason | "reconnecting" | "rate_limit_soft",
  locale: UiLocale = "en",
): string {
  const calmLocale: CalmSystemLocale = locale === "it" ? "it" : "en";
  return calmInboxLoadErrorMessage(reason, calmLocale);
}
