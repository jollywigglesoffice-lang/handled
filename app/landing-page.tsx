"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompletedCounter } from "@/app/landing/completed-counter";
import { InboxZeroJourney } from "@/app/landing/inbox-zero-journey";
import { SocialProof } from "@/app/landing/social-proof";
import { TransformationSection } from "@/app/landing/transformation-section";
import { supabaseBrowser } from "@/lib/supabase-browser";

const WORKFLOWS = [
  {
    id: "school",
    title: "School Email",
    steps: ["Worth your attention", "Done with this", "Saved for reference"],
  },
  {
    id: "accountant",
    title: "Accountant",
    steps: ["Waiting on reply", "Waiting 7 days", "Response received"],
  },
  {
    id: "travel",
    title: "Travel Confirmation",
    steps: ["Suggested action", "Save for reference", "One click", "Completed"],
  },
] as const;

const WORKFLOW_CARD =
  "block rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 transition-colors duration-200 hover:border-gray-200 hover:bg-gray-50/80";

const WORKFLOW_CARD_FINAL =
  "block rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-[#0F172A] transition-colors duration-200 hover:border-gray-300 hover:bg-gray-100/80";

export function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/emails");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
        <span className="text-sm font-semibold tracking-tight">Handled</span>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-500 transition-colors duration-200 hover:text-gray-900"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-12 sm:px-8">
        <section className="pt-2 sm:pt-3">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-[2.75rem] sm:leading-[1.08]">
              Email that remembers.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl sm:leading-relaxed">
              The best email is the one you never have to think about again.
            </p>
            <p className="mt-3 max-w-lg text-lg font-medium leading-snug tracking-tight text-[#0F172A] sm:text-xl">
              Stop organizing email.{" "}
              <span className="text-[#9733ff]">Start finishing it.</span>
            </p>
            <p className="mt-2 max-w-md text-base leading-relaxed text-gray-500">
              Every email should end somewhere — completed, waiting on, or out of your head.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
              <Link href="/login?next=/emails" className="btn-primary px-6 py-3 text-base">
                Connect Gmail
              </Link>
              <a
                href="#workflows"
                className="btn-secondary px-6 py-3 text-base text-gray-700 transition-colors duration-200 hover:border-gray-300"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="mt-9 w-full sm:mt-10 lg:mt-12">
            <InboxZeroJourney />
          </div>

          <div className="mt-8 sm:mt-9">
            <SocialProof />
          </div>

          <TransformationSection />
        </section>

        <div className="mt-8 max-w-xs">
          <CompletedCounter />
        </div>

        <section className="mt-10 border-t border-gray-100 pt-8 sm:mt-11">
          <blockquote className="max-w-lg">
            <p className="text-lg leading-relaxed text-gray-600">
              Most email tools organize messages.
            </p>
            <p className="mt-1.5 text-lg font-medium leading-relaxed text-[#0F172A]">
              Handled learns what you do with them.
            </p>
          </blockquote>
        </section>

        <section id="workflows" className="mt-10 scroll-mt-8 sm:mt-11">
          <h2 className="text-xs font-medium uppercase tracking-widest text-gray-400">
            How it works
          </h2>

          <div className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-7">
            {WORKFLOWS.map((flow) => (
              <article
                key={flow.id}
                className="group transition-colors duration-200 hover:opacity-95"
              >
                <h3 className="text-lg font-semibold tracking-tight transition-colors duration-200 group-hover:text-gray-900">
                  {flow.title}
                </h3>
                <ol className="mt-3 space-y-0">
                  {flow.steps.map((step, index) => (
                    <li key={step}>
                      {index > 0 ? (
                        <span
                          className="my-1 block text-xs text-gray-300"
                          aria-hidden
                        >
                          ↓
                        </span>
                      ) : null}
                      <span
                        className={
                          index === flow.steps.length - 1
                            ? WORKFLOW_CARD_FINAL
                            : WORKFLOW_CARD
                        }
                      >
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-gray-100 pt-10 text-center sm:mt-14">
          <p className="text-sm text-gray-500">Finish email. Don&apos;t manage it.</p>
          <Link
            href="/login?next=/emails"
            className="btn-primary mt-5 inline-flex px-6 py-3 text-base"
          >
            Connect Gmail
          </Link>
        </section>
      </main>
    </div>
  );
}
