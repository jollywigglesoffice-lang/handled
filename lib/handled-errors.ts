import type { InboxLoadFailureReason } from "@/lib/inbox-load/types";
import {
  calmInboxLoadErrorTitle,
  calmRetryLabel,
  type CalmSystemLocale,
} from "@/lib/calm-system-copy";
import { inboxLoadUserMessage } from "@/lib/inbox-load/user-messages";
import type { UiLocale } from "@/lib/ui-copy";

export type HandledErrorCategory =
  | "auth"
  | "network"
  | "gmail"
  | "server"
  | "account"
  | "data";

export type HandledErrorAction =
  | "retry"
  | "reconnect_gmail"
  | "connect_account"
  | "sign_in"
  | "sign_out"
  | "none";

export type HandledError = {
  code: string;
  category: HandledErrorCategory;
  userMessage: string;
  actionLabel: string;
  action: HandledErrorAction;
  /** Optional short title for error panels */
  title?: string;
};

function calmLocale(locale: UiLocale): CalmSystemLocale {
  return locale === "it" ? "it" : "en";
}

function actionLabels(locale: UiLocale): Record<HandledErrorAction, string> {
  const retry = calmRetryLabel(calmLocale(locale));
  return locale === "it"
    ? {
        retry,
        reconnect_gmail: "Riconnetti Gmail",
        connect_account: "Collega Gmail",
        sign_in: "Accedi",
        sign_out: "Esci e accedi di nuovo",
        none: "",
      }
    : {
        retry,
        reconnect_gmail: "Reconnect Gmail",
        connect_account: "Connect Gmail",
        sign_in: "Sign in",
        sign_out: "Sign out and back in",
        none: "",
      };
}

const INBOX_FAILURE_MAP: Record<
  InboxLoadFailureReason,
  { category: HandledErrorCategory; action: HandledErrorAction }
> = {
  network_error: { category: "network", action: "retry" },
  timeout: { category: "server", action: "retry" },
  auth_error: { category: "auth", action: "reconnect_gmail" },
  missing_account: { category: "account", action: "connect_account" },
  gmail_fetch_failed: { category: "gmail", action: "retry" },
  gmail_rate_limit: { category: "gmail", action: "retry" },
  db_error: { category: "server", action: "retry" },
  server_unavailable: { category: "server", action: "retry" },
  categorization_failure: { category: "data", action: "retry" },
  headers_too_large: { category: "server", action: "sign_out" },
  unknown: { category: "server", action: "retry" },
};

export function handledErrorFromInboxFailure(
  reason: InboxLoadFailureReason,
  locale: UiLocale = "en",
): HandledError {
  const meta = INBOX_FAILURE_MAP[reason] ?? INBOX_FAILURE_MAP.unknown;
  const labels = actionLabels(locale);
  return {
    code: reason,
    category: meta.category,
    userMessage: inboxLoadUserMessage(reason, locale),
    actionLabel: labels[meta.action],
    action: meta.action,
    title: calmInboxLoadErrorTitle(reason, calmLocale(locale)),
  };
}

export function handledErrorResponse(
  error: HandledError,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    {
      error: error.code,
      failureReason: error.code,
      category: error.category,
      userMessage: error.userMessage,
      actionLabel: error.actionLabel,
      action: error.action,
      title: error.title,
      ...extra,
    },
    { status },
  );
}
