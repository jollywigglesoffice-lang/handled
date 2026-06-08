"use client";

import { CompletionActionsProvider } from "./completion-actions-context";
import { CompletionWorkflowProvider } from "./completion-workflow-context";
import { InboxCategoriesProvider } from "./inbox-categories-context";
import { EmailCompletionsProvider } from "./email-completions-context";
import { WaitingOnMetadataProvider } from "./waiting-on-metadata-context";
import { ReplyUsageProvider } from "./reply-usage-context";
import { UserPreferencesProvider } from "./user-preferences-context";
import { SyncToast } from "./components/sync-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserPreferencesProvider>
      <InboxCategoriesProvider>
        <CompletionActionsProvider>
          <ReplyUsageProvider>
            <EmailCompletionsProvider>
              <WaitingOnMetadataProvider>
                <CompletionWorkflowProvider>
                  {children}
                  <SyncToast />
                </CompletionWorkflowProvider>
              </WaitingOnMetadataProvider>
            </EmailCompletionsProvider>
          </ReplyUsageProvider>
        </CompletionActionsProvider>
      </InboxCategoriesProvider>
    </UserPreferencesProvider>
  );
}
