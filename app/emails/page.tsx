import { Suspense } from "react";
import { EmailsClient } from "@/app/components/emails-client";
import { InboxLoadingState } from "@/app/emails/inbox-loading-state";

export const dynamic = "force-dynamic";

export default function EmailsPage() {
  return (
    <Suspense fallback={<InboxLoadingState locale="en" />}>
      <EmailsClient />
    </Suspense>
  );
}
