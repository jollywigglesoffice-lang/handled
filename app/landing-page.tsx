"use client";

import Link from "next/link";
import { CompletedCounter } from "@/app/landing/completed-counter";
import { InboxZeroJourney } from "@/app/landing/inbox-zero-journey";
import { SocialProof } from "@/app/landing/social-proof";
import { TransformationSection } from "@/app/landing/transformation-section";

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

const LOGIN_NEXT = "/login?next=/emails";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
        <span className="text-sm font-semibold tracking-tight">Handled</span>
        <Link
          href={LOGIN_NEXT}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          <GoogleIcon />
          Continue with Google
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
              Handled helps you finish email in minutes, not hours — with categories you control
              and AI that learns what you actually do with each message.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
              <Link
                href={LOGIN_NEXT}
                className="inline-flex items-center gap-2.5 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-accent-hover active:scale-[0.99]"
              >
                <GoogleIcon />
                Continue with Google
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
            href={LOGIN_NEXT}
            className="mt-5 inline-flex items-center gap-2.5 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-accent-hover active:scale-[0.99]"
          >
            <GoogleIcon />
            Continue with Google
          </Link>
        </section>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path
        fill="currentColor"
        fillOpacity="0.95"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.8"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.65"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.85"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
