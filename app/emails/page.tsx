import { Suspense } from "react";
import { AuthResolutionProvider } from "@/app/auth-resolution-context";
import { EmailsClient } from "@/app/components/emails-client";
import { InboxLoadingState } from "@/app/emails/inbox-loading-state";

export const dynamic = "force-dynamic";

export default function EmailsPage() {
  return (
    <AuthResolutionProvider mode="app">
      <Suspense fallback={<InboxLoadingState locale="en" />}>
        <EmailsClient />
      </Suspense>
    </AuthResolutionProvider>
  );
}
