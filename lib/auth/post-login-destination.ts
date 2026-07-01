import {
  destinationForOnboardingCompleted,
  INBOX_PATH,
  ONBOARDING_PATH,
  redirectAfterAuthenticatedLogin,
  redirectOnceToDestination,
} from "@/lib/onboarding/post-auth-gate";

export {
  destinationForOnboardingCompleted,
  INBOX_PATH,
  ONBOARDING_PATH,
  redirectOnceToDestination,
} from "@/lib/onboarding/post-auth-gate";

export const POST_LOGIN_DESTINATION = INBOX_PATH;

export function getPostLoginDestination(onboardingCompleted = false): string {
  return destinationForOnboardingCompleted(onboardingCompleted);
}

/** Password login — one API call, one redirect. */
export async function redirectToInboxAfterLogin(): Promise<void> {
  await redirectAfterAuthenticatedLogin("password_login");
}

/** @deprecated Use redirectAfterAuthenticatedLogin */
export function redirectToInboxAfterLoginSync(): void {
  void redirectAfterAuthenticatedLogin("password_login_legacy");
}
