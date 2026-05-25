"use client";

import Link from "next/link";
import { IntentChips } from "@/app/components/intent-chips";
import { CalmShimmerBlock, CalmShimmerLines } from "@/app/components/calm-loading";
import type { EmailPreviewCache } from "@/lib/email-preview-cache";

type EmailDetailSkeletonProps = {
  preview: EmailPreviewCache | null;
  backLabel: string;
  openingLabel: string;
};

/** Mirrors detail layout — cached inbox row shows instantly. */
export function EmailDetailSkeleton({
  preview,
  backLabel,
  openingLabel,
}: EmailDetailSkeletonProps) {
  const cached =
    preview?.sender && preview?.subject ? preview : null;

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 calm-fade-in">
        <Link
          href="/emails"
          className="text-sm text-gray-400 transition-colors hover:text-gray-600"
        >
          {backLabel}
        </Link>

        <header className="mt-6 space-y-3">
          {cached ? (
            <>
              <p className="text-sm text-gray-500">{cached.sender}</p>
              <h1 className="text-2xl font-semibold leading-snug tracking-tight text-gray-900 sm:text-[1.65rem]">
                {cached.subject}
              </h1>
              {cached.summary ? (
                <p className="text-[15px] leading-relaxed text-gray-700">{cached.summary}</p>
              ) : (
                <CalmShimmerLines lines={2} />
              )}
              {cached.chips && cached.chips.length > 0 ? (
                <IntentChips chips={cached.chips} />
              ) : null}
            </>
          ) : (
            <>
              <CalmShimmerBlock className="h-4 w-40" />
              <CalmShimmerBlock className="h-8 w-full max-w-lg" />
              <CalmShimmerLines lines={2} />
            </>
          )}
        </header>

        <article className="mt-8 space-y-3">
          <p className="text-xs font-medium text-gray-400">Email</p>
          <div className="space-y-2 rounded-lg border border-gray-100 bg-white/60 p-4">
            <CalmShimmerLines lines={6} />
          </div>
        </article>

        <section className="mt-10 space-y-3 border-t border-gray-100 pt-6">
          <div className="flex items-center gap-2">
            <span className="calm-accent-pulse h-2 w-2 rounded-full" aria-hidden />
            <p className="text-sm text-gray-500">{openingLabel}</p>
          </div>
          <CalmShimmerBlock className="h-28 w-full accent" />
        </section>
      </div>
    </main>
  );
}
