import { Suspense } from "react";
import { AuthResolutionProvider } from "@/app/auth-resolution-context";
import { OnboardingClient } from "@/app/components/onboarding-client";
import { InboxLoadingState } from "@/app/emails/inbox-loading-state";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <AuthResolutionProvider mode="app">
      <Suspense fallback={<InboxLoadingState locale="en" />}>
        <OnboardingClient />
      </Suspense>
    </AuthResolutionProvider>
  );
}
