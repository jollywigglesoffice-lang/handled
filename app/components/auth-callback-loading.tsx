"use client";

/** Neutral loading shell for OAuth callback — no inbox or onboarding UI. */
export function AuthCallbackLoading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-sm text-gray-500">Signing you in…</p>
    </main>
  );
}
