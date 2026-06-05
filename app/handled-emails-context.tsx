"use client";

/** @deprecated Import from `@/app/email-completions-context` */
export {
  EmailCompletionsProvider as HandledEmailsProvider,
  useHandledEmails,
  useEmailCompletions,
} from "@/app/email-completions-context";

export { LEGACY_HANDLED_EMAIL_IDS_KEY as HANDLED_EMAIL_IDS_KEY } from "@/lib/email-completions/client-storage";
