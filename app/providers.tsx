"use client";

import { HandledEmailsProvider } from "./handled-emails-context";
import { ReplyUsageProvider } from "./reply-usage-context";
import { UserPreferencesProvider } from "./user-preferences-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserPreferencesProvider>
      <ReplyUsageProvider>
        <HandledEmailsProvider>{children}</HandledEmailsProvider>
      </ReplyUsageProvider>
    </UserPreferencesProvider>
  );
}
