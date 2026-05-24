"use client";

import Link from "next/link";

export default function AuthConfirmedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <section className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-7 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted text-xl text-accent">
          ✓
        </div>

        <h1 className="text-2xl font-semibold text-[#0F172A]">Email confirmed</h1>

        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Your account is ready. Please return to Handled and sign in to continue.
        </p>

        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          Handled helps you write better replies faster while keeping you in control.
        </p>

        <Link
          href="/emails"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Go back to Handled
        </Link>
      </section>
    </main>
  );
}
