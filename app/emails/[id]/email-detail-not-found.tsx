"use client";

import Link from "next/link";
import { useUiCopy } from "@/app/use-ui-copy";

export function EmailDetailNotFound({ emailId }: { emailId: string }) {
  const ui = useUiCopy();

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-16 sm:px-6">
      <div className="mx-auto w-full max-w-lg space-y-4 calm-fade-in">
        <Link href="/emails" className="text-sm text-gray-400 hover:text-gray-600">
          {ui.common.backToInbox}
        </Link>
        <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            {ui.calm.errors.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {ui.calm.empty.noUnresolved}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Ref: <span className="font-mono">{emailId.slice(0, 12)}…</span>
          </p>
        </section>
      </div>
    </main>
  );
}
