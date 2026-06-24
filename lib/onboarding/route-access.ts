/** @deprecated Import from @/lib/auth/decide-next-route instead. */
export {
  ONBOARDING_PATH,
  INBOX_PATH,
  isOnboardingGatedPath,
  isOnboardingRoute,
  shouldRequireOnboarding,
  syncOnboardingCompletionState,
  decideNextRoute,
  navigateAfterAuthSuccess,
  resolveAppRouteGuard,
  resolvePostAuthPath,
  logPostLoginRouteDecision,
} from "@/lib/auth/decide-next-route";

export { logPostAuthRoute as logOnboardingRouteDecision } from "@/lib/auth/decide-next-route";
