"use client";

import { InboxCategoriesProvider } from "./inbox-categories-context";
import { HandledEmailsProvider } from "./handled-emails-context";
import { ReplyUsageProvider } from "./reply-usage-context";
import { UserPreferencesProvider } from "./user-preferences-context";
import { SyncToast } from "./components/sync-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserPreferencesProvider>
      <InboxCategoriesProvider>
        <ReplyUsageProvider>
          <HandledEmailsProvider>
            {children}
            <SyncToast />
          </HandledEmailsProvider>
        </ReplyUsageProvider>
      </InboxCategoriesProvider>
    </UserPreferencesProvider>
  );
}
