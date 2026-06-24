/** @deprecated Boot controller handles routing — this hook is a no-op. */
export function useOnboardingRouteGuard(): void {
  // Routing is owned by lib/auth/boot-controller.ts via AuthResolutionProvider.
}
