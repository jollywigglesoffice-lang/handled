"use client";

import { useEffect, useMemo, useState } from "react";
import type { LandingLocale } from "@/lib/landing-copy";
import { getLandingCopy } from "@/lib/landing-copy";

type JourneyPhase = "inbox_full" | "processing" | "emptying" | "inbox_zero";

const PACE = 1.25;

const INBOX_FULL_MS = Math.round(3_750 * PACE);
const PROCESSING_END_MS = Math.round(12_500 * PACE);
const EMPTYING_END_MS = Math.round(16_875 * PACE);
const INBOX_ZERO_PAUSE_MS = 3_000;
const LOOP_MS = EMPTYING_END_MS + INBOX_ZERO_PAUSE_MS;
const EMAIL_SLOT_MS = Math.round(2_875 * PACE);
const EMAIL_STEP_1_MS = Math.round(1_375 * PACE);
const EMAIL_STEP_2_MS = Math.round(2_250 * PACE);
const EMPTYING_DURATION_MS = Math.round(4_375 * PACE);
const CLUTTER_BAR_LENGTH = 10;
const CLUTTER_LEVELS = [10, 8, 6, 2] as const;
const CLUTTER_STEP_MS = 720;

const INITIAL_COUNTS = {
  attention: 12,
  good_to_know: 14,
  promotions: 22,
  newsletters: 8,
};

const FINAL_WORKFLOW = {
  handled: 41,
  activeWaiting: 3,
};

const PROCESSING_EMAILS = [
  {
    id: "amazon",
    label: "Amazon Order",
    steps: ["Saved for reference", "Handled"],
    outcome: "handled" as const,
  },
  {
    id: "accountant",
    label: "Accountant",
    steps: ["Waiting on reply", "Waiting on someone"],
    outcome: "waiting" as const,
  },
  {
    id: "school",
    label: "School Email",
    steps: ["Replied", "Handled"],
    outcome: "handled" as const,
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  attention: "text-violet-700",
  good_to_know: "text-slate-600",
  promotions: "text-amber-700",
  newsletters: "text-indigo-700",
};

type CategoryKey = "attention" | "good_to_know" | "promotions" | "newsletters";

function phaseAtElapsed(ms: number): JourneyPhase {
  const t = ms % LOOP_MS;
  if (t < INBOX_FULL_MS) return "inbox_full";
  if (t < PROCESSING_END_MS) return "processing";
  if (t < EMPTYING_END_MS) return "emptying";
  return "inbox_zero";
}

function processingIndex(ms: number): number {
  const t = (ms % LOOP_MS) - INBOX_FULL_MS;
  if (t < 0) return -1;
  return Math.min(2, Math.floor(t / EMAIL_SLOT_MS));
}

function processingStep(ms: number): number {
  const t = (ms % LOOP_MS) - INBOX_FULL_MS;
  if (t < 0) return 0;
  const local = t % EMAIL_SLOT_MS;
  return local < EMAIL_STEP_1_MS ? 0 : local < EMAIL_STEP_2_MS ? 1 : 2;
}

function inboxZeroElapsed(ms: number): number {
  const t = (ms % LOOP_MS) - EMPTYING_END_MS;
  return Math.max(0, Math.min(INBOX_ZERO_PAUSE_MS, t));
}

function clutterStepIndex(elapsedInPhase: number): number {
  const steps = CLUTTER_LEVELS.length;
  if (elapsedInPhase >= steps * CLUTTER_STEP_MS) return steps;
  return Math.floor(elapsedInPhase / CLUTTER_STEP_MS);
}

function clutterBar(filled: number): string {
  const empty = CLUTTER_BAR_LENGTH - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

function emptyingCounts(ms: number) {
  const t = (ms % LOOP_MS) - PROCESSING_END_MS;
  const progress = Math.min(1, Math.max(0, t / EMPTYING_DURATION_MS));
  const ease = 1 - (1 - progress) ** 2;
  return {
    attention: Math.round(INITIAL_COUNTS.attention * (1 - ease)),
    good_to_know: Math.round(INITIAL_COUNTS.good_to_know * (1 - ease)),
    promotions: Math.round(INITIAL_COUNTS.promotions * (1 - ease)),
    newsletters: Math.round(INITIAL_COUNTS.newsletters * (1 - ease)),
    handled: Math.round(FINAL_WORKFLOW.handled * ease * 0.7),
    activeWaiting: Math.round(FINAL_WORKFLOW.activeWaiting * ease),
  };
}

export function InboxZeroJourney({ locale }: { locale: LandingLocale }) {
  const journey = useMemo(() => getLandingCopy(locale).journey, [locale]);
  const categories = useMemo(
    () =>
      journey.categories.map((cat) => ({
        ...cat,
        color: CATEGORY_COLORS[cat.key] ?? "text-slate-600",
      })),
    [journey.categories],
  );
  const [elapsed, setElapsed] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setElapsed(now - start);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const phase = reducedMotion ? "inbox_zero" : phaseAtElapsed(elapsed);
  const procIdx = processingIndex(elapsed);
  const procStep = processingStep(elapsed);
  const emptying = emptyingCounts(elapsed);

  const counts: Record<CategoryKey, number> =
    phase === "inbox_full"
      ? INITIAL_COUNTS
      : phase === "emptying"
        ? {
            attention: emptying.attention,
            good_to_know: emptying.good_to_know,
            promotions: emptying.promotions,
            newsletters: emptying.newsletters,
          }
        : phase === "inbox_zero"
          ? { attention: 0, good_to_know: 0, promotions: 0, newsletters: 0 }
          : {
              attention: Math.max(0, INITIAL_COUNTS.attention - procIdx * 3),
              good_to_know: Math.max(0, INITIAL_COUNTS.good_to_know - procIdx * 4),
              promotions: Math.max(0, INITIAL_COUNTS.promotions - procIdx * 5),
              newsletters: Math.max(0, INITIAL_COUNTS.newsletters - procIdx * 2),
            };

  const isInboxZero = phase === "inbox_zero";

  return (
    <div
      className={`relative w-full min-h-[25rem] overflow-hidden rounded-3xl border bg-[#FAFBFC] shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow] duration-1000 ease-out sm:min-h-[29rem] ${
        isInboxZero
          ? "landing-inbox-zero-glow border-[#9733ff]/20"
          : "border-gray-200/90"
      }`}
      aria-hidden
    >
      <div className="border-b border-gray-100 px-6 py-4 sm:px-7 sm:py-5">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Handled</p>
        <p className="mt-0.5 text-base font-semibold text-[#0F172A] sm:text-lg">{journey.today}</p>
      </div>

      <div className="space-y-5 p-6 transition-opacity duration-1000 sm:space-y-6 sm:p-8">
        {phase === "inbox_zero" ? (
          <InboxZeroPayoff
            elapsedInPhase={inboxZeroElapsed(elapsed)}
            reducedMotion={reducedMotion}
            journey={journey}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.key}
                  className="rounded-xl border border-gray-100 bg-white px-3 py-3 transition-all duration-700 sm:px-4 sm:py-3.5"
                >
                  <p className={`text-xs font-medium leading-tight sm:text-[13px] ${cat.color}`}>
                    {cat.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[#0F172A] transition-all duration-700 sm:text-3xl">
                    {counts[cat.key as CategoryKey]}
                  </p>
                </div>
              ))}
            </div>

            {phase === "processing" && procIdx >= 0 ? (
              <div className="relative min-h-[8.5rem] sm:min-h-[9.5rem]">
                {PROCESSING_EMAILS.map((email, i) => {
                  if (i !== procIdx) return null;
                  const isDone = procStep >= 2;
                  const lines: [string, string | null][] = [
                    [email.label, null],
                    [email.steps[0], email.label],
                    [
                      email.steps[1] ?? journey.handled,
                      email.outcome === "waiting" ? journey.waitingOnSomeone : journey.handled,
                    ],
                  ];
                  const [main, sub] = lines[procStep] ?? lines[0];

                  return (
                    <div
                      key={email.id}
                      className="absolute inset-x-0 top-0 landing-journey-enter"
                    >
                      <div
                        className={`rounded-xl border px-4 py-3.5 transition-all duration-1000 ease-out sm:px-5 sm:py-4 ${
                          isDone
                            ? email.outcome === "waiting"
                              ? "border-amber-100 bg-amber-50/50"
                              : "border-emerald-100 bg-emerald-50/40"
                            : "border-gray-200 bg-white"
                        }`}
                        style={{ transform: `translateY(${procStep * -4}px)` }}
                      >
                        {procStep === 1 ? (
                          <p className="mb-1 truncate text-sm text-gray-400">
                            {email.label} →
                          </p>
                        ) : null}
                        <p className="truncate text-base font-medium text-[#0F172A] sm:text-lg">
                          {main}
                        </p>
                        {sub && procStep >= 1 ? (
                          <p
                            className={`mt-1 truncate text-sm ${
                              isDone
                                ? email.outcome === "waiting"
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                                : "text-gray-400"
                            }`}
                          >
                            {procStep === 2 ? "✓ " : "→ "}
                            {sub}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : phase === "emptying" ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500 sm:px-5 sm:py-3.5">
                <span>{journey.clearingInbox}</span>
                <span className="tabular-nums">
                  {journey.clearingStats(emptying.handled, emptying.activeWaiting)}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {journey.previewEmails.map((preview) => (
                    <div
                      key={preview}
                      className="rounded-xl border border-gray-100 bg-white px-4 py-3 sm:px-5 sm:py-3.5"
                    >
                      <p className="truncate text-sm text-gray-600">{preview}</p>
                    </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InboxZeroPayoff({
  elapsedInPhase,
  reducedMotion,
  journey,
}: {
  elapsedInPhase: number;
  reducedMotion: boolean;
  journey: ReturnType<typeof getLandingCopy>["journey"];
}) {
  const stepIndex = reducedMotion ? CLUTTER_LEVELS.length : clutterStepIndex(elapsedInPhase);

  return (
    <div className="flex min-h-[16rem] flex-col items-center justify-center py-5 landing-journey-enter sm:min-h-[18rem] sm:py-7">
      <div className="landing-inbox-zero-badge flex items-center gap-2.5 rounded-2xl border border-[#9733ff]/20 bg-white/80 px-6 py-4 sm:px-8 sm:py-5">
        <span className="text-lg text-[#9733ff]/85 sm:text-xl" aria-hidden>
          ✓
        </span>
        <span className="text-lg font-semibold tracking-tight text-[#0F172A] sm:text-xl">
          {journey.inboxZero}
        </span>
      </div>

      <MentalClutterDrain stepIndex={stepIndex} label={journey.mentalClutter} />

      <ul className="mt-6 w-full max-w-xs space-y-2.5 text-center sm:max-w-sm sm:space-y-3">
        <PayoffLine value={FINAL_WORKFLOW.handled} label={journey.handled} />
        <PayoffLine value={FINAL_WORKFLOW.activeWaiting} label={journey.waitingOnSomeone} />
        {stepIndex >= CLUTTER_LEVELS.length ? (
          <PayoffLine value={0} label={journey.mentalClutter} highlight />
        ) : null}
      </ul>
    </div>
  );
}

function MentalClutterDrain({
  stepIndex,
  label,
}: {
  stepIndex: number;
  label: string;
}) {
  const showZero = stepIndex >= CLUTTER_LEVELS.length;
  const visibleCount = showZero ? CLUTTER_LEVELS.length : stepIndex + 1;

  return (
    <div className="mt-5 w-full max-w-[10.5rem] sm:max-w-[11rem]" aria-hidden>
      <p className="text-center text-xs font-medium tracking-wide text-gray-400">
        {label}
      </p>
      <div className="mt-2.5 space-y-1.5 font-mono text-[10px] leading-none sm:text-[11px]">
        {CLUTTER_LEVELS.slice(0, visibleCount).map((level, i) => {
          const isCurrent = !showZero && i === stepIndex;
          const isPast = showZero || i < stepIndex;

          return (
            <p
              key={level}
              className={`text-center transition-all duration-700 ease-out ${
                isCurrent ? "text-gray-400/90" : "text-gray-300/50"
              }`}
              style={{ opacity: isPast ? 0.28 : isCurrent ? 1 : 0.85 }}
            >
              {clutterBar(level)}
            </p>
          );
        })}
        {showZero ? (
          <p className="pt-1 text-center font-sans text-2xl font-semibold tabular-nums tracking-tight text-[#9733ff]/85 sm:text-3xl">
            0
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PayoffLine({
  value,
  label,
  highlight,
}: {
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-center gap-2 tabular-nums">
      <span
        className={`text-2xl font-semibold tracking-tight sm:text-3xl ${
          highlight ? "text-[#9733ff]/90" : "text-[#0F172A]"
        }`}
      >
        {value}
      </span>
      <span className="text-sm text-gray-500 sm:text-base">{label}</span>
    </li>
  );
}
