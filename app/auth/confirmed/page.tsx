"use client";

import Link from "next/link";
import { LanguageFooterToggle } from "@/app/components/language-footer-toggle";
import { useUiCopy } from "@/app/use-ui-copy";

export default function AuthConfirmedPage() {
  const ui = useUiCopy();

  return (
    <main className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <div className="flex flex-1 items-center justify-center px-4">
        <section className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted text-xl text-accent">
            ✓
          </div>

          <h1 className="text-2xl font-semibold text-[#0F172A]">{ui.auth.confirmedTitle}</h1>

          <p className="mt-3 text-sm leading-relaxed text-gray-500">{ui.auth.confirmedBody}</p>

          <p className="mt-3 text-xs leading-relaxed text-gray-400">{ui.auth.confirmedHint}</p>

          <Link
            href="/emails"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            {ui.auth.confirmedCta}
          </Link>
        </section>
      </div>
      <LanguageFooterToggle className="pb-8" />
    </main>
  );
}
